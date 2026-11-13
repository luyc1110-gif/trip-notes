'use client';

import { useState } from 'react';
import type { Todo } from '@/lib/types';
import type { Ctx } from '../TripApp';
import { SkyBand } from '../Scenes';
import { Icon } from '../ui';

export default function Todos({ ctx }: { ctx: Ctx }) {
  const { snap, store, me } = ctx;
  const [text, setText] = useState('');
  const open = snap.todos.filter((t) => !t.done);
  const done = snap.todos.filter((t) => t.done);

  async function add() {
    const value = text.trim();
    if (!value) return;
    if (await store.act({ op: 'todo.add', text: value })) setText('');
  }

  const row = (t: Todo) => (
    <div className={`item ${t.done ? 'done' : ''}`} key={t.id} style={{ minHeight: 52, padding: '4px 4px 4px 14px' }}>
      <input
        id={`todo-${t.id}`}
        className="check"
        type="checkbox"
        checked={t.done}
        disabled={store.busy}
        onChange={(e) => store.act({ op: 'todo.toggle', id: t.id, done: e.target.checked })}
      />
      <label htmlFor={`todo-${t.id}`} className={`todo-label ${t.done ? 'done' : ''}`}>
        {t.text}
      </label>
      <button className="icon-btn muted" aria-label={`刪除「${t.text}」`} disabled={store.busy} onClick={() => store.act({ op: 'todo.delete', id: t.id })}>
        <Icon name="trash" size={20} />
      </button>
    </div>
  );

  return (
    <div className="screen">
      <header className="band">
        <SkyBand />
        <div className="band-text">
          <h1 className="h1">我的待辦</h1>
          <div className="meta">
            {me.name}的清單
            {snap.todos.length > 0 ? `・已完成 ${done.length}／${snap.todos.length}` : ''}
          </div>
        </div>
      </header>

      <div className="body with-tabs">
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <label className="label" htmlFor="todo-new">新增待辦</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="todo-new" className="input" maxLength={80} placeholder="例如：帶雨傘" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="icon-btn gold" type="submit" aria-label="加入清單" disabled={store.busy || !text.trim()}>
              <Icon name="plus" stroke={2.5} />
            </button>
          </div>
        </form>

        {snap.todos.length === 0 && (
          <p className="empty">這是你自己的清單，其他同行者有各自的一份。把出發前要做的事記在這裡。</p>
        )}

        {open.length > 0 && <div className="stack">{open.map(row)}</div>}

        {done.length > 0 && (
          <section className="stack">
            <h2 className="sm muted">已完成 {done.length} 項</h2>
            {done.map(row)}
          </section>
        )}
      </div>
    </div>
  );
}
