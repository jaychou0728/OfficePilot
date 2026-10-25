export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <strong>OfficePilot</strong>
        <span>星海科技 · 办公工作台</span>
      </header>
      <main className="workspace">
        <aside className="library"><div className="placeholder">01 / 文档库</div></aside>
        <section className="conversation"><div className="placeholder">02 / 对话</div></section>
        <aside className="inspector"><div className="placeholder">03 / 证据 · 结果 · 链路</div></aside>
      </main>
    </div>
  );
}
