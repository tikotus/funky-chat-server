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
    client.on('join', channelName => {
      client.join(channelName)
      updateState(addClientToChannel(clientId, channelName))
      if (messages.get(channelName))
        client.emit('messages', messages.get(channelName).toJS(), channelName)
    })
    client.on('message', (msg, channelName) => {
      messages = messages.update(channelName, List(), v => v.push({ sender: name, text: msg }))
      io.to(channelName).emit('message', name, msg, channelName)
    })
  })

  client.on('disconnect', () => {
    updateState(state
      .update('clients', seq => seq.filter(v => v.get('clientId') != clientId))
      .update('channels', channels => channels.map(channel => removeClientFromChannel(channel, clientId))))
  })
});

function updateState(newState) {
  state = newState
  io.emit('changeState', state.toJS())
}

function changeClientName(clientId, name) {
  return state.setIn(['clients', state.get('clients').findIndex(c => c.get('clientId') == clientId), 'name'], name)
}

function removeClientFromChannel(channel, clientId) {
  return channel.update('joinedClientIds', ids => ids.filter(id => id != clientId))
}

function addClientToChannel(clientId, channelName) {
  return state.updateIn(['channels', channelName, 'joinedClientIds'], List(), v => v.push(clientId))
}
