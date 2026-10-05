import { createRoot } from 'react-dom/client'
import { RetiredGame } from './RetiredGame'
import { initTelegram } from './telegram'
import { initLang } from './i18n'
import './theme.css'

initLang()
initTelegram()
createRoot(document.getElementById('root')!).render(<RetiredGame />)
