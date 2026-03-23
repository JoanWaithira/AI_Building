import { useRef, useState } from 'react'
import './App.css'
import CesiumGeoJsonViewer from './components/CEsiumGeoJsonViewer.jsx'
import FacilityChatbot from './components/FacilityChatbot.jsx'


function App() {
  const viewerRef = useRef(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [viewMode, setViewMode] = useState('room')
  const [selectedFloor, setSelectedFloor] = useState('all')

  const handleFeatureClick = (roomData) => {
    setSelectedRoom(roomData)
    console.log('Selected room:', roomData)
  }

  return (
    <div className="app-layout">
      <div className="viewer-area">
        <CesiumGeoJsonViewer
          ref={viewerRef}
          onFeatureClick={handleFeatureClick}
          viewMode={viewMode}
          selectedFloor={selectedFloor}
          showExterior={true}
        />
      </div>
      <FacilityChatbot />
    </div>
  )
}

export default App
