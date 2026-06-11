import * as reducerType from '../../unit/reducerType';

let initState = false;

const invite = (state = initState, action) => {
  switch (action.type) {
    case reducerType.INVITE: 
      return action.data;
    default:
      return state;
  }
};

export default invite;
