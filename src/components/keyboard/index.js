import React from 'react';import Immutable from 'immutable'; 
import propTypes from 'prop-types';
import style from './index.less';
import Button from './button';
import store from '../../store';
 import todo from '../../control/todo';
 import { i18n, lan } from '../../unit/const';
export default class Keyboard extends React.Component {  constructor(props) { super(props); this.state = {  inviteActive: false  };
  }
componentDidMount() {
  const touchEventCatch = {};
  const mouseDownEventCatch = {};
  
  document.addEventListener('touchstart', (e) => {
    if (e.cancelable && e.preventDefault) e.preventDefault();
  }, { passive: false, capture: true });
  
  document.addEventListener('touchend', (e) => {
    if (e.cancelable && e.preventDefault) e.preventDefault();
  }, { passive: false, capture: true });
  
  document.addEventListener('gesturestart', (e) => {
    if (e.preventDefault) event.preventDefault();
  });
  
  document.addEventListener('mousedown', (e) => {
    if (e.preventDefault) e.preventDefault();
  }, true);
  
  Object.keys(todo).forEach((key) => {
    if (!this[`dom_${key}`] || !this[`dom_${key}`].dom) return;
    
const triggerLeaderboard = (score) => {
  if (key !== 'l') return;
  if (this.props.showLeaderboard) {
    this.props.showLeaderboard(score);
  }
};
    
    // Обработчики для мыши (ПК)
    this[`dom_${key}`].dom.addEventListener('mousedown', (e) => {
      if (touchEventCatch[key] === true) return;
      todo[key].down(store);
      mouseDownEventCatch[key] = true;
    }, true);
    
    this[`dom_${key}`].dom.addEventListener('mouseup', (e) => {
      if (touchEventCatch[key] === true) {
        touchEventCatch[key] = false;
        return;
      }
      todo[key].up(store);
      mouseDownEventCatch[key] = false;
      triggerLeaderboard(this.props.max || 0);
    }, true);
    
    this[`dom_${key}`].dom.addEventListener('mouseout', () => {
      if (mouseDownEventCatch[key] === true) todo[key].up(store);
    }, true);
    
    // Обработчики для касаний (мобильные)
    this[`dom_${key}`].dom.addEventListener('touchstart', (e) => {
      touchEventCatch[key] = true;
      todo[key].down(store);
    }, true);
    
    this[`dom_${key}`].dom.addEventListener('touchend', (e) => {
      todo[key].up(store);
      triggerLeaderboard(this.props.max || 0);
    }, true);
  });
  // ========== ДОБАВЛЯЕМ ОБРАБОТЧИК ДЛЯ КНОПКИ MODE ==========
  if (this.dom_mode && this.dom_mode.dom) {
    const modeKey = 'mode';
    
    this.dom_mode.dom.addEventListener('mousedown', (e) => {
      if (todo[modeKey] && todo[modeKey].down) {
        todo[modeKey].down(store);
      }
    }, true);
    
    this.dom_mode.dom.addEventListener('mouseup', (e) => {
      if (todo[modeKey] && todo[modeKey].up) {
        todo[modeKey].up(store);
      }
    }, true);
    
    this.dom_mode.dom.addEventListener('touchstart', (e) => {
      if (todo[modeKey] && todo[modeKey].down) {
        todo[modeKey].down(store);
      }
    }, true);
    
    this.dom_mode.dom.addEventListener('touchend', (e) => {
      if (todo[modeKey] && todo[modeKey].up) {
        todo[modeKey].up(store);
      }
    }, true);
  }

}


  shouldComponentUpdate({ keyboard, filling }, nextState) {    return !Immutable.is(keyboard, this.props.keyboard) ||  filling !== this.props.filling || nextState.showLeaderboard !== this.state.showLeaderboard ||
           nextState.loadingStatus !== this.state.loadingStatus;  }
  render() {    const keyboard = this.props.keyboard; const leaderboardLabel = i18n.leaderboard ? i18n.leaderboard[lan] : 'Top'; return (
      <div
        className={style.keyboard}
        style={{ marginTop: 20 + this.props.filling, position: 'relative' }}
      >
         {/* Кнопки приставки */}
        <Button
          color="green"
          size="s2"
          top={0}
          left={16}
          label={`${i18n.pause[lan]}(P)`}
          active={keyboard.get('pause')}
          ref={(c) => { this.dom_p = c; }}
        />
        <Button
          color="green"
          size="s2"
          top={0}
          left={106}
          label={`${i18n.sound[lan]}(S)`}
          active={keyboard.get('music')}
          ref={(c) => { this.dom_s = c; }}
        />
        <Button
          color="red"
          size="s2"
          top={0}
          left={196}
          label={`${i18n.reset[lan]}(R)`}
          active={keyboard.get('reset')}
          ref={(c) => { this.dom_r = c; }}
        />
        <Button
          color="yellow"
          size="s2"
          top={0}
          left={286}
          label={`${leaderboardLabel}(L)`}
          active={keyboard.get('leaderboard')}
          ref={(c) => { this.dom_l = c; }}
        />
        {/* Кнопка приглашения друзей ВК (Системная проверка анимации после добавления экшена) */}
        <Button
          color="yellow"     
          size="s2"
          top={80}
          left={0}
          label="옷"          
          active={keyboard.get('invite')} 
          ref={(c) => { this.dom_invite = c; }} 
        />
<Button
  color="yellow"
  size="s2"
  top={80}
  left={215}
  label="🎮"
  active={keyboard.get('mode')}
  ref={(c) => { this.dom_mode = c; }}
/>


        {/* Кнопки движений */}
        <Button
          color="blue"
          size="s1"
          top={0}
          left={374}
          label={i18n.rotation[lan]}
          arrow="translate(0, 63px)"
          position
          active={keyboard.get('rotate')}
          ref={(c) => { this.dom_rotate = c; }}
        />
        <Button
          color="blue"
          size="s1"
          top={180}
          left={374}
          label={i18n.down[lan]}
          arrow="translate(0,-71px) rotate(180deg)"
          active={keyboard.get('down')}
          ref={(c) => { this.dom_down = c; }}
        />
        <Button
          color="blue"
          size="s1"
          top={90}
          left={284}
          label={i18n.left[lan]}
          arrow="translate(60px, -12px) rotate(270deg)"
          active={keyboard.get('left')}
          ref={(c) => { this.dom_left = c; }}
        />
        <Button
          color="blue"
          size="s1"
          top={90}
          left={464}
          label={i18n.right[lan]}
          arrow="translate(-60px, -12px) rotate(90deg)"
          active={keyboard.get('right')}
          ref={(c) => { this.dom_right = c; }}
        />
        <Button
          color="blue"
          size="s0"
          top={100}
          left={52}
          label={`${i18n.drop[lan]} (SPACE)`}
          active={keyboard.get('drop')}
          ref={(c) => { this.dom_space = c; }}
        />
      </div>
    );
  }
}

Keyboard.propTypes = {
  filling: propTypes.number.isRequired,
  keyboard: propTypes.object.isRequired,
  // Внутри Keyboard.propTypes внизу файла:
invite: propTypes.bool,
  showLeaderboard: propTypes.func,
 mode: propTypes.bool, 
};
