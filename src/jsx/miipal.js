var STORAGE_NAME_KEY = '_name';

var NameForm = React.createClass({
  handleSubmit: function(e) {
    e.preventDefault();

    var name = React.findDOMNode(this.refs.name).value.trim();
    if (!name)
      return;

    this.props.onRegister(name);
  },
  render: function() {
    return (
      <form className="nameForm" onSubmit={this.handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input type="text" id="name" className="form-control" placeholder="Po-Shen Loh" ref="name" autoFocus="autoFocus" />
        </div>
      </form>
    );
  }
});

var NameLabel = React.createClass({
  render: function() {
    return (
      <h3>Hi {this.props.name}!</h3>
    );
  }
});

var UserSelectForm = React.createClass({
  handleSubmit: function(e) {
    e.preventDefault();
    
    var selectedUser = React.findDOMNode(this.refs.user).value;
    // Do nothing if user selected the default option
    if (!selectedUser)
      return;

    this.props.onNewConversation(selectedUser);
  },
  render: function() {
    var users = this.props.users.map(function(user, index) {
      return (
        <option key={index} value={user}>{user}</option>
      );
    });
    return (
      <form className="userSelectForm" onChange={this.handleSubmit}>
        <div className="form-group">
          <label htmlFor="user">Start a Conversation</label>
          <select id="user" className="form-control" ref="user" defaultValue="">
            <option value="">Select a user...</option>
            {users}
          </select>
        </div>
      </form>
    );
  }
});

var ChatBar = React.createClass({
  render: function() {
    return (
      <div className="chatBar panel panel-default row">
        <div className="panel-body">
          <div className="col-sm-4">
            {this.props.name ? <NameLabel name={this.props.name} /> : <NameForm onRegister={this.props.onRegister} />}
          </div>
          <div className="col-sm-8">
            <UserSelectForm users={this.props.users} onNewConversation={this.props.handleNewConversation} />
          </div>
        </div>
      </div>
    );
  }
});

var ChatMessages = React.createClass({
  render: function() {
    var messageNodes = this.props.messages.map(function(message, index) {
      return (
        <div key={index}>
          {message}
        </div>
      );
    });

    return (
      <div className="chatMessages">
        {messageNodes}
      </div>
    );
  }
});

var ChatInputForm = React.createClass({
  handleSubmit: function(e) {
    e.preventDefault();

    var message = React.findDOMNode(this.refs.message).value.trim();
    // If empty message do nothing
    if (!message)
      return;

    this.props.onMessageSubmit(message);
    React.findDOMNode(this.refs.message).value = '';
  },
  render: function() {
    return (
      <form className="chatInputForm" onSubmit={this.handleSubmit}>
        <input type="text" placeholder="Enter your message..." ref="message" autoFocus="autoFocus" />
      </form>
    );
  }
});

var ChatBox = React.createClass({
  getMessages: function() {
    if (isStorageSupported() && (messages = localStorage.getItem(this.props.friendName)))
      return JSON.parse(messages);
    else
      return [];
  },
  getInitialState: function() {
    return {messages: this.getMessages()};
  },
  addAndStoreNewMessage: function(message) {
    // Update messages state
    var newMessageList = this.state.messages.slice();
    newMessageList.push(message);
    this.setState({messages: newMessageList});

    // Store the new message
    if (isStorageSupported()) {
      localStorage.setItem(this.props.friendName, JSON.stringify(newMessageList));
    }
  },
  handleMessageSubmit: function(message) {
    // Prepend user's name to message
    message = this.props.myName + ': ' + message;

    this.addAndStoreNewMessage(message);
    // Send the message to the server
    sendMessage(this.props.myName, this.props.friendName, message);
  },
  componentWillReceiveProps: function(nextProps) {
    if (nextProps.latestMessage !== '')
      this.addAndStoreNewMessage(nextProps.latestMessage);
  },
  render: function() {
    return (
      <div className="chatBox">
        <h2>{this.props.friendName}</h2>
        <ChatMessages messages={this.state.messages} />
        <ChatInputForm onMessageSubmit={this.handleMessageSubmit} />
      </div>
    );
  }
});

var ChatSystem = React.createClass({
  getName: function() {
    if (isStorageSupported() && (name = localStorage.getItem(STORAGE_NAME_KEY)))
      return name;

    // Local storage not supported or user not registered
    return '';
  },
  addUser: function(data) {
    var newUser = data.user;

    // If new user is not the same as the current user
    if (newUser !== this.state.name) {
      // Add the new user to the user list
      var newUserList = this.state.users.slice();
      newUserList.push(newUser);

      this.setState({users: newUserList});
    }
  },
  removeUser: function(data) {
    var user = data['user'];
    var newUserList = this.state.users.slice();
    var index = newUserList.indexOf(user);

    // If user is found in the user list, remove user
    if (index >= 0) {
      newUserList.splice(index, 1);
      this.setState({users: newUserList});
    }
  },
  updateUsers: function(data) {
    var users = data['user_list'];
    this.setState({users, users});
  },
  newMessage: function(data) {
    var sender = data.sender;
    var message = data.message;

    if (this.state.conversations.indexOf(sender) < 0) {
      var newConversations = this.state.conversations.slice();
      newConversations.push(sender);
      /**
       * It is important that a new conversation be given its own setState()
       * call because componentWillReceiveProps() will not be called for the
       * initial render of a component.
       */
      this.setState({conversations: newConversations});
    }

    var latestMessage = {
      friendName: sender,
      message: message
    };
    this.setState({latestMessage: latestMessage}, function() {
      var defaultMessage =  {
        friendName: '',
        message: ''
      };
      this.setState({latestMessage: defaultMessage});
    });
  },
  getInitialState: function() {
    return {
      name: this.getName(),
      users: [],
      conversations: [],
      latestMessage: {
        friendName: '',
        message: ''
      }
    }
  },
  componentDidMount: function() {
    // Register all the event listeners
    socket.on('add user', this.addUser);
    socket.on('remove user', this.removeUser);
    socket.on('update users', this.updateUsers);
    socket.on('new message', this.newMessage);

    // If client is already registered, join the chat network
    if (this.state.name)
      joinServer(this.state.name);
    
    // Get the list of currently connected users
    getUsers();
  },
  registerUser: function(name) {
    // Client tried to register with invalid name
    if (name === STORAGE_NAME_KEY)
      return;

    if (isStorageSupported()) {
      localStorage.setItem(STORAGE_NAME_KEY, name);
      this.setState({name: name});
      joinServer(name);
    }
  },
  handleNewConversation: function(user) {
    // User has invalid name
    if (user === STORAGE_NAME_KEY)
      return;

    if (this.state.conversations.indexOf(user) < 0) {
      var newList = this.state.conversations.slice();
      newList.push(user);
      this.setState({conversations: newList});
    }
  },
  render: function() {
    var myName = this.state.name;
    var latestMessage = this.state.latestMessage;
    var chatBoxes = this.state.conversations.map(function(friendName, index) {
      var message = latestMessage.friendName === friendName ?
        latestMessage.message : '';
      return (
        <div key={index} className="col-sm-2">
          <ChatBox myName={myName} friendName={friendName} latestMessage={message} />
        </div>
      );
    });
    return (
      <div className="chatSystem">
        <h1>Miipal</h1>
        <ChatBar name={this.state.name} users={this.state.users}
                 onRegister={this.registerUser}
                 handleNewConversation={this.handleNewConversation} />
        <div className="row">
          {chatBoxes}
        </div>
      </div>
    );
  }
});

React.render(
  <ChatSystem />,
  document.getElementById('content')
);

/**
 * Determine if local storage is supported.
 */
function isStorageSupported() {
  return typeof(Storage) !== 'undefined';
}