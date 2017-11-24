const { fromJS, toJS, List, Map } = require('immutable')
const io = require('socket.io')(3000, {
  serveClient: false,
});

let state = fromJS({
  channels: {},
  clients: []
})

let messages = Map()

let idCounter = 0;
io.on('connection', client => {
  const clientId = ++idCounter
  let name = 'Guest' + idCounter

  client.on('init', fn => {
    client.removeAllListeners('init')
    updateState(state.update('clients', v => v.push(fromJS({ name: name, clientId }))))
    fn(clientId)

    client.on('nick', val => {
      name = val
      updateState(changeClientName(clientId, name))
    })
    client.on('join', chan => {
      client.join(chan)
      updateState(addClientToChannel(clientId, chan))
      if (messages.get(chan))
        client.emit('messages', messages.get(chan).toJS(), chan)
    })
    client.on('message', (msg, chan) => {
      messages = messages.update(chan, List(), v => v.push({ sender: name, text: msg }))
      io.to(chan).emit('message', name, msg, chan)
    })
  })

  client.on('disconnect', reason => {
    updateState(state
      .update('clients', seq => seq.filter(v => v.clientId != clientId))
      .update('channels', channels => channels.map(chan => removeClientFromChannel(chan, clientId))))
  })
});

function updateState(newState) {
  state = newState
  io.emit('changeState', state.toJS())
}

function changeClientName(clientId, name) {
  return state.setIn(['clients', state.get('clients').findIndex(c => c.clientId == clientId), 'name'], name)
}

function removeClientFromChannel(channel, clientId) {
  return channel.update('joinedClientIds', ids => ids.filter(id => id != clientId))
}

function addClientToChannel(clientId, chan) {
  return state.updateIn(['channels', chan, 'joinedClientIds'], List(), v => v.push(clientId))
}
