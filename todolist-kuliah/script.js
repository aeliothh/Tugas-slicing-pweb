//js DOM: tambah, centang, hapus, filter dan tampilkan tugas.
'use strict';
const STORAGE_KEY = 'catat-tugas-v1';
const THEME_KEY = 'catat-tema-v1';
const $ = selector => document.querySelector(selector);
let activeFilter = 'semua';
let deletedTask = null;
let toastTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00');
  return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}
function warnStorage(message) {
  $('#storage-warning').textContent = message;
  $('#storage-warning').hidden = false;
}
function initialTasks() {
  return DATA_APLIKASI.tugasAwal.map(task => ({ ...task }));
}
function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return initialTasks();
    const data = JSON.parse(stored);
    if (!Array.isArray(data)) throw new Error('Format data tidak sesuai');
    const ids = new Set();
    return data.filter(task => task && typeof task.id === 'string' && typeof task.judul === 'string' && task.judul.trim() && typeof task.selesai === 'boolean').map(task => ({
      id: task.id, judul: task.judul.slice(0, 160),
      matkul: typeof task.matkul === 'string' ? task.matkul.slice(0, 80) : '',
      deadline: typeof task.deadline === 'string' && validDate(task.deadline) ? task.deadline : '',
      selesai: task.selesai
    })).filter(task => {
      if (ids.has(task.id)) return false;
      ids.add(task.id); return true;
    });
  } catch {
    warnStorage('Data browser tidak dapat dibaca. Contoh tugas ditampilkan; penyimpanan akan dicoba saat ada perubahan.');
    return initialTasks();
  }
}
let tasks = loadTasks();
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    $('#storage-warning').hidden = true;
  } catch {
    warnStorage('Browser tidak mengizinkan penyimpanan. Perubahan hanya tersedia selama halaman ini terbuka.');
  }
}
function formatDate(value) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value + 'T00:00:00'));
}
function deadlineLabel(task) {
  if (!task.deadline) return 'Tanpa deadline';
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const deadline = new Date(task.deadline + 'T00:00:00');
  if (!task.selesai && deadline < now) return 'Lewat deadline · ' + formatDate(task.deadline);
  if (deadline.getTime() === now.getTime()) return 'Deadline hari ini';
  return 'Deadline ' + formatDate(task.deadline);
}
function visibleTasks() {
  return tasks.filter(task => activeFilter === 'semua' || (activeFilter === 'selesai' ? task.selesai : !task.selesai));
}
function render() {
  const total = tasks.length;
  const done = tasks.filter(task => task.selesai).length;
  const pending = total - done;
  $('#task-summary').textContent = total === 0 ? 'Belum ada tugas yang dicatat.' : pending === 0 ? 'Semua tugas sudah selesai.' : `${pending} tugas masih perlu dikerjakan.`;
  $('#completed-count').textContent = `${done} / ${total} selesai`;
  $('#count-all').textContent = total;
  $('#count-pending').textContent = pending;
  $('#count-done').textContent = done;
  const percent = total ? Math.round(done / total * 100) : 0;
  $('#progress-fill').style.width = percent + '%';
  $('.progress-track').setAttribute('aria-valuenow', String(percent));
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter)));
  const list = $('#task-list'); list.replaceChildren();
  const filtered = visibleTasks();
  filtered.forEach(task => {
    const row = element('li', task.selesai ? 'task-row is-done' : 'task-row');
    row.dataset.id = task.id;
    const check = element('input', 'task-check');
    check.type = 'checkbox'; check.checked = task.selesai;
    check.setAttribute('aria-label', `${task.selesai ? 'Tandai belum selesai' : 'Tandai selesai'}: ${task.judul}`);
    const content = element('div', 'task-content');
    content.append(element('span', 'task-title', task.judul));
    const meta = element('div', 'task-meta');
    if (task.matkul) meta.append(element('span', 'task-course', task.matkul));
    const deadline = element(task.deadline ? 'time' : 'span', 'task-date', deadlineLabel(task));
    if (task.deadline) deadline.dateTime = task.deadline;
    meta.append(deadline); content.append(meta);
    const remove = element('button', 'task-delete', '×');
    remove.type = 'button'; remove.setAttribute('aria-label', `Hapus tugas: ${task.judul}`); remove.title = 'Hapus tugas';
    row.append(check, content, remove); list.append(row);
  });
  $('#empty-state').hidden = filtered.length !== 0;
  $('#empty-title').textContent = activeFilter === 'selesai' ? 'Belum ada tugas selesai' : activeFilter === 'belum' && total ? 'Semua sudah beres' : 'Belum ada tugas';
  $('#empty-description').textContent = activeFilter === 'selesai' ? 'Tugas yang sudah dicentang akan muncul di sini.' : activeFilter === 'belum' && total ? 'Kamu bisa menambahkan tugas berikutnya.' : 'Tambahkan tugas lewat form Tambah tugas.';
  $('#result-count').textContent = `Menampilkan ${filtered.length} dari ${total} tugas.`;
}
function hideToast() {
  clearTimeout(toastTimer); $('#toast').hidden = true; deletedTask = null;
}
function showToast(message, allowUndo = false) {
  clearTimeout(toastTimer);
  if (!allowUndo) deletedTask = null;
  $('#toast-text').textContent = message;
  $('#undo-button').hidden = !allowUndo;
  $('#toast').hidden = false;
  toastTimer = setTimeout(hideToast, allowUndo ? 10000 : 4000);
}
const form = $('#task-form');
$('#task-title').addEventListener('input', () => $('#task-title').setCustomValidity(''));
form.addEventListener('submit', event => {
  event.preventDefault();
  const title = $('#task-title').value.trim();
  const deadline = $('#task-date').value;
  if (!title) {
    $('#task-title').setCustomValidity('Isi nama tugas terlebih dahulu.'); $('#task-title').reportValidity(); return;
  }
  if (deadline && !validDate(deadline)) { showToast('Tanggal deadline tidak valid.'); return; }
  const id = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `tugas-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  tasks.unshift({ id, judul: title, matkul: $('#task-course').value.trim(), deadline, selesai: false });
  activeFilter = 'semua'; saveTasks(); render(); form.reset();
  $('#task-title').focus(); showToast('Tugas ditambahkan.');
});
$('.filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter; render();
});
$('#task-list').addEventListener('change', event => {
  if (!event.target.matches('.task-check')) return;
  const row = event.target.closest('[data-id]');
  const task = tasks.find(item => item.id === row.dataset.id);
  task.selesai = event.target.checked; saveTasks(); render();
  const remainingRow = Array.from($('#task-list').children).find(item => item.dataset.id === task.id);
  if (remainingRow) remainingRow.querySelector('.task-check').focus();
  else document.querySelector(`[data-filter="${activeFilter}"]`).focus();
  showToast(task.selesai ? 'Tugas ditandai selesai.' : 'Tugas ditandai belum selesai.');
});
$('#task-list').addEventListener('click', event => {
  const button = event.target.closest('.task-delete');
  if (!button) return;
  const row = button.closest('[data-id]');
  const index = tasks.findIndex(task => task.id === row.dataset.id);
  deletedTask = { task: tasks[index], index };
  tasks.splice(index, 1); saveTasks(); render();
  document.querySelector(`[data-filter="${activeFilter}"]`).focus();
  showToast('Tugas dihapus.', true);
});
$('#undo-button').addEventListener('click', () => {
  if (!deletedTask) return;
  tasks.splice(Math.min(deletedTask.index, tasks.length), 0, deletedTask.task);
  deletedTask = null; saveTasks(); render(); showToast('Tugas dikembalikan.');
});
$('#toast-close').addEventListener('click', hideToast);
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-button').textContent = theme === 'dark' ? '☀' : '☾';
  $('#theme-button').setAttribute('aria-label', theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
}
let theme = 'light';
try { if (localStorage.getItem(THEME_KEY) === 'dark') theme = 'dark'; } catch { /* Gunakan tema awal. */ }
applyTheme(theme);
$('#theme-button').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* Tema masih bisa diganti. */ }
});
document.querySelectorAll('[data-field]').forEach(node => { node.textContent = DATA_APLIKASI[node.dataset.field] || ''; });
document.title = DATA_APLIKASI.nama;
document.querySelector('meta[name="description"]').content = DATA_APLIKASI.deskripsi;
$('#today').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
$('#year').textContent = new Date().getFullYear();
render();
