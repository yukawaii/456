import * as reducerType from '../../unit/reducerType';

let initState = false;

const mode = (state = initState, action) => {
  switch (action.type) {
    case reducerType.MODE:
      return action.data;
    default:
      return state;
  }
};

export default mode;