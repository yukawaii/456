import React from 'react';

export default class ModeShapes extends React.Component {
  constructor() {
    super();
    this.state = {
      currentMode: 'tetra', // По умолчанию ТЕТРА
    };
  }

  componentDidMount() {
    console.log('ModeShapes mounted');
    console.log('window.currentGameMode при монтировании:', window.currentGameMode);
    
    // Проверяем localStorage
    try {
      const saved = localStorage.getItem('tetris_game_mode');
      console.log('localStorage tetris_game_mode:', saved);
    } catch(e) {}
    
    this.updateMode();
    // Проверяем каждую секунду
    this.interval = setInterval(() => {
      this.updateMode();
    }, 1000);
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  updateMode() {
    let mode = window.currentGameMode;
  //  console.log('updateMode: window.currentGameMode =', mode);
    
    // Если глобальная переменная не установлена, читаем из localStorage
    if (!mode) {
      try {
        mode = localStorage.getItem('tetris_game_mode');
        console.log('updateMode: из localStorage =', mode);
      } catch(e) {}
    }
    
    // Если всё ещё нет - ставим ТЕТРА по умолчанию
    if (!mode) {
      mode = 'tetra';
    }
    
    if (mode !== this.state.currentMode) {
      console.log('Режим изменился с', this.state.currentMode, 'на', mode);
      this.setState({ currentMode: mode === 'tetra' ? 'tetra' : 'classic' });
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