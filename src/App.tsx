import { ApiKeySettings } from './components/ApiKeySettings'
import { ChatWindow } from './components/ChatWindow'
import { DocumentManager } from './components/DocumentManager'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1>제이봇</h1>
        <p>정비사업(재개발·재건축) 문서 기반 AI 챗봇</p>
      </header>
      <div className="app-shell__body">
        <aside className="app-shell__sidebar">
          <ApiKeySettings />
          <hr />
          <DocumentManager />
        </aside>
        <main className="app-shell__main">
          <ChatWindow />
        </main>
      </div>
    </div>
  )
}

export default App
