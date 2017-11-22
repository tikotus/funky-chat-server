const { fromJS, toJS, List } = require('immutable')
const io = require('socket.io')(3000, {
  serveClient: false,
});

let state = fromJS({
  channels: {},
  clients: []
})

let connections = []

let idCounter = 0;
io.on('connection', client => {
  const clientId = ++idCounter
  let name = 'Guest' + idCounter

  connections.push(client)
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
    })
    client.on('message', (msg, chan) => { 
      io.to(chan).emit('message', name, msg, chan)
    })
  })

  client.on('disconnect', reason => {
    const index = connections.indexOf(client)
    connections.splice(index, 1)
    updateState(state
      .update('clients', seq => seq.filter(v => v.clientId != clientId))
      .update('channels', channels => channels.map(chan => removeClientFromChannel(chan, clientId))))
  })
});

function updateState(newState) {
  state = newState
  connections.forEach(c => c.emit('changeState', state.toJS()))
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
