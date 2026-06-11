import React from 'react';
import cn from 'classnames';
import propTypes from 'prop-types';

import style from './index.less';
import { i18n, lan } from '../../unit/const';

export default class Mode extends React.Component {
  constructor() {
    super();
    this.state = {
      display: 'none',
    };
  }
  
  componentWillMount() {
    // Регистрируем глобальную функцию для показа окна
    window.showModeSelection = () => {
      this.animate();
    };
  }
  
  componentWillUnmount() {
    window.showModeSelection = null;
    clearTimeout(Mode.timeout);
  }
  
  animate() {
    clearTimeout(Mode.timeout);
    this.setState({ display: 'none' });
    
    const set = (func, delay) => {
      if (!func) return;
      Mode.timeout = setTimeout(func, delay);
    };
    
    const show = (func) => {
      set(() => {
        this.setState({ display: 'block' });
        if (func) func();
      }, 150);
    };
    
    const hide = (func) => {
      set(() => {
        this.setState({ display: 'none' });
        if (func) func();
      }, 150);
    };
    
    show(() => {
      hide(() => {
        show(() => {
          // Оставляем окно открытым
        });
      });
    });
  }
  
  handleSelect = (mode) => {
    this.setState({ display: 'none' });
    if (this.props.onSelect) {
      this.props.onSelect(mode);
    }
  };
  
  render() {
    return (
      <div className={style.mode} style={{ display: this.state.display }}>
        <div className={style.modeContent}>
          <p>{i18n.selectMode?.[lan] || 'Выберите режим'}</p>
          <div className={style.buttons}>
            <button onClick={() => this.handleSelect('classic')}>
              {i18n.modeClassic?.[lan] || 'Классика'}
            </button>
            <button onClick={() => this.handleSelect('tetra')}>
              {i18n.modeTetra?.[lan] || 'Тетра'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

Mode.propTypes = {
  onSelect: propTypes.func,
};

Mode.defaultProps = {
  onSelect: () => {},
};

Mode.statics = {
  timeout: null,
};