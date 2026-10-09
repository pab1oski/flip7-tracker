import { HashRouter, Route, Routes } from 'react-router-dom'
import Home from './ui/screens/Home'
import NewGame from './ui/screens/NewGame'
import GameScreen from './ui/screens/GameScreen'
import Settlement from './ui/screens/Settlement'
import History from './ui/screens/History'
import PlayerStats from './ui/screens/PlayerStats'
import PlayerProfile from './ui/screens/PlayerProfile'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewGame />} />
        <Route path="/game/:id" element={<GameScreen />} />
        <Route path="/game/:id/settlement" element={<Settlement />} />
        <Route path="/history" element={<History />} />
        <Route path="/players" element={<PlayerStats />} />
        <Route path="/players/:id" element={<PlayerProfile />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </HashRouter>
  )
}
