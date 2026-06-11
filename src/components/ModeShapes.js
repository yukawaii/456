import React from 'react';

export default class ModeShapes extends React.Component {
  constructor() {
    super();
    this.state = {
      currentMode: 'tetra', // Всегда ТЕТРА при запуске
    };
  }

  componentDidMount() {
    console.log('ModeShapes mounted');
    
    // Запускаем проверку каждую секунду
    this.interval = setInterval(() => {
      this.updateMode();
    }, 500);
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  updateMode() {
    const mode = window.currentGameMode;
    
    // Если есть новое значение от mode.js - обновляем
    if (mode && mode !== this.state.currentMode) {
      console.log('Режим изменился на:', mode);
      this.setState({ currentMode: mode });
    }
  }
  
  render() {
    const modeText = this.state.currentMode === 'classic' ? 'КЛАССИКА' : 'ТЕТРА';
    
    return (
      <div style={{
        position: 'absolute',
        bottom: '25px',
        right: '4px',
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid #ffd700',
        borderRadius: '8px',
        padding: '8px',
        color: '#ffd700',
        fontSize: '12px',
        zIndex: 100
      }}>
        {modeText}
      </div>
    );
  }
}