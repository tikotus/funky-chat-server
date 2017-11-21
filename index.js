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
  let name = "unknown"

  connections.push(client)
  client.on('init', name => {
    client.removeAllListeners('init')
    updateState(state.update("clients", v => v.push({ name: name, id: clientId})))
    
    client.on('changeName', val => {
      name = val
      updateState(changeClientName(clientId, name))
    })
    client.on('join', chan => {
      client.join(chan)
      updateState(addClientToChannel(clientId, chan))
    
    })
    client.on('message', (msg, chan) => { 
      client.to(chan).emit('message', client.name, msg) 
    })
  })

  client.on('disconnect', reason => {
    const index = connections.indexOf(client)
    connections.splice(index, 1)
    updateState(state
      .update("clients", seq => seq.filter(v => v.id != clientId))
      .update("channels", channels => channels.map(chan => removeClientFromChannel(chan, clientId))))
  })
});

function updateState(newState) {
  state = newState
  connections.forEach(c => c.emit('changeState', state.toJS()))
}

function changeClientName(clientId) {
  return state.setIn(["clients", state.clients.findIndex(c => c.id == clientId), name], name)
}

function removeClientFromChannel(channel, clientId) {
  return channel.update("joinedClientIds", ids => ids.filter(id => id != clientId))
}

function addClientToChannel(clientId, chan) {
  return state.updateIn(["channels", chan, "joinedClientIds"], List([]), v => v.push(clientId))
}
