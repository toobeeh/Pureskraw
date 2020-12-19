class Node {
    events = document.createElement("div");
    canvasProperties = {height:600, width:800};
    _endConnections = [];
    _peer;
    _username;
    _avatarData;
    get id() {
        return this._peer.id;
    }
    get username() {
        return this._username;
    }
    get avatarData() {
        return this._avatarData;
    }
    constructor(username, avatarData) {
        if (!username) throw errorGenerator.usernameMissing("No username provided.");
        this._username = username;
        this._avatarData = avatarData;
        this._peer = new Peer();
        this._peer.on("open",() => {
            this._peer.on("connection", this.onconnect);
            console.log(`Opened node with id ${this.id}.\nWaiting for end peers.`);
            this.events.dispatchEvent(new CustomEvent("create", { detail: { id: this.id } }));
        });
    }

    onconnect = connection => {
        console.log(`Node ${connection.peer} requested connection...`);
        this._endConnections.push({ id: connection.connectionId, connection: connection});
        connection.on("data", (data) => { ConnectionHandler.ondata(data, this, false); });
        connection.on("close", () => {
            let conn = this._endConnections.find(e=> e.connection.peer == connection.peer);
            this._endConnections = this._endConnections.filter(e => e.connection.peer != connection.peer);
            let msg = messageGenerator.playerLeft(conn.connection.peer, conn.username);
            this.send(msg);
            ConnectionHandler.playerLeft(msg.detail);
            this.send()
        });
        setTimeout(() => {
            this.send(messageGenerator.connect(this._peer.id, this._username, this.canvasProperties.height, this.canvasProperties.width), connection.connectionId);
        }, 200);
    }

    send = (data, id = 0) => {
        this._endConnections.filter(e => e.id == id || id == 0).forEach(e => {
            e.connection.send(data);
        });
    }
}

class End {
    events = document.createElement("div");
    _peer;
    _nodeConnection;
    _nodeID;
    _username;
    _avatarData;
    nodeUsername;
    get avatarData() {
        return this._avatarData;
    }
    get username() {
        return this._username;
    }
    get id() {
        return this._peer.id;
    }
    constructor(nodeID, username, avatarData) {
        if (!username) throw errorGenerator.usernameMissing("No username provided.");
        this._username = username;
        this._avatarData = avatarData;
        if (!nodeID) throw errorGenerator.sessionMissing("No node ID provided.");
        this._peer = new Peer();
        this._nodeID = nodeID;
        this._peer.on("open",() => {
            console.log(`Opened peer with id ${this.id}.\nConnecting to node ${nodeID}..."`);
            this._nodeConnection = this._peer.connect(nodeID);
            this._nodeConnection.on("data", (data) => { ConnectionHandler.ondata(data, false, this); });
        });
    }

    send = (data) => {
        this._nodeConnection.send(data);
    }
}

const messageGenerator = {
    connected: (peerID, username) => { return { event: "connected", id: peerID, detail: { username: username, id: peerID} }; },
    connect: (peerID, username, canvasWidth, canvasHeight) => { return { event: "connect", id: peerID, detail: { username: username, id: peerID, canvasHeight: canvasHeight, canvasWidth: canvasWidth } }; },
    drawcommand: (peerID, username, commands) => { return { event: "drawcommand", id: peerID, detail: { username: username, id: peerID, commands: commands } }; },
    snapshot: (peerID, username, snapshot) => { return { event: "snapshot", id: peerID, detail: { username: username, id: peerID, snapshot: snapshot } }; },
    chatMessageCreated: (peerID, username, content) => { return { event: "chatMessageCreated", id: peerID, detail: { username: username, id: peerID, content: content } }; },
    incomingChatMessage: (peerID, senderPeerID, senderUsername, content) => { return { event: "incomingChatMessage", id: peerID, detail: { username: senderUsername, id: senderPeerID, content: content } }; },
    lobbyPlayer: (peerID, username, avatarData, owner) => { return { event: "lobbyPlayer", id: peerID, detail: { username: username, avatarData: avatarData, owner: owner, id: peerID } }; },
    playerLeft: (peerID, username) => { return { event: "playerLeft", id: peerID, detail: { username: username,  id: peerID } };}
}
const errorGenerator = {
    sessionMissing: (msg) => { let err = new Error(msg); err.name = "sessionMissing"; return err; },
    usernameMissing: (msg) => { let err = new Error(msg); err.name = "usernameMissing"; return err; }
}

/*
 * Connection flow:
 * - node creates peer and shares peer ID
 * - end creates peer and requests connection to peer ID 
 *      -> Node fires a peer.connection event, responds to end with connect message to show accepted connect request
 *      -> End fires connection.data event, has connect mesage. Sends connected message to node to indicate finished connection setup.
 *      -> Node fires connection.data event, has connected message. Adds end with its username to connection list.
 * 
 * Message Flow:
 * - message gets typed and addchatmsg called
 * - addchatmsg creates a msg created message
 * - if sender is node, directly call msgcreated handler, else send message with msgcreated
 *      -> Node fires msgcreated event, creates message with username and connection peer id
 *      -> Node sends msgadded message to all ends which execute a chatmsgadded if not their own peer id
 */

class ConnectionHandler { 
    static ondata = (data, node, end) => {
        let event = data.event;
        let detail = data.detail;
        if (!event || !detail) throw new Error("Received message without event or detail:" + data);
        switch (data.event) {
            case "connect":
                this.connect(detail, end || node);
                break;
            case "connected":
                this.connected(detail, end || node);
                break;
            case "drawcommand":
                this.drawcommand(detail, node, data);
                break;
            case "snapshot":
                this.snapshot(detail, end || node);
                break;
            case "chatMessageCreated":
                this.chatMessageCreated(detail, node);
                break;
            case "incomingChatMessage":
                this.incomingChatMessage(detail, end || node);
                break;
            case "lobbyPlayer":
                this.lobbyPlayer(detail, end || node);
                break;
            case "playerLeft":
                this.playerLeft(detail);
                break;
        }
    }

    static connect = (detail, peer) => {
        console.log(`Node ${detail.id} with username ${detail.username} accepted the connection.`);
        peer.send(messageGenerator.connected(peer._peer.id, peer._username), detail.id);
        peer.events.dispatchEvent(new CustomEvent("connect", { detail: detail }));
    }
    static connected = (detail, peer) => {
        console.log(`Connected to end ${detail.id} with username ${detail.username}.`);
        // if node, add username to connection
        if (peer.constructor.name == "Node") {
            peer._endConnections.forEach(e => {
                if (e.connection.peer == detail.id) e.username = detail.username;
            });
            ConnectionHandler.chatMessageCreated(messageGenerator.chatMessageCreated(-1, "Session", detail.username + " joined the session.").detail, peer, true);
            // send player join data, clients have to listen to event
        }
        peer.events.dispatchEvent(new CustomEvent("connect", { detail: detail }));
    }
    static lobbyPlayer = (detail, peer) => {
        // if node, add player and send other player data
        if (peer.constructor.name == "Node") {
            let playerMessages = [];
            addOrUpdateLobbyPlayer(detail.id, detail.username, detail.avatarData, detail.owner);
            playerMessages.push(messageGenerator.lobbyPlayer(peer.id, peer.username, peer.avatarData, true));

            peer._endConnections.forEach(e => {
                if (e.connection.peer == detail.id) {
                    e.avatarData = detail.avatarData;
                    e.username = detail.username;
                    e.owner = detail.owner;
                    addOrUpdateLobbyPlayer(detail.id, detail.username, detail.avatarData, detail.owner);
                }
                playerMessages.push(messageGenerator.lobbyPlayer(e.connection.peer, e.username, e.avatarData))
            });
            playerMessages.forEach(m => peer.send(m));
        }
        else {
            addOrUpdateLobbyPlayer(detail.id, detail.username, detail.avatarData, detail.owner);
            if (detail.owner) setSessionInfo(peer._nodeID, canvas.height, canvas.width, detail.username);
        }
    }
    static drawcommand = (detail, node, data) => {
        canvas.addIncomingDrawCommands(detail.commands);
        if (node) node._endConnections.forEach(c => {
            if (c.connection.peer != detail.id) node.send(data, c.id);
        });
    }
    static snapshot = (detail, peer) => {
        canvas.putSnapshot(detail.snapshot, true);
    }
    static chatMessageCreated = (detail, node, session = false) => {
        // if node, send messageadded event
        if (node.constructor.name == "Node") {
            let username = session ? "Session" :
                detail.id == node.id ? node._username :
                    node._endConnections.find(e => e.connection.peer == detail.id).username;
            let message = messageGenerator.incomingChatMessage(peer.id, detail.id, username, detail.content);
            node.send(message);
            // trigger incoming message on own
            ConnectionHandler.incomingChatMessage(message.detail, node);
        }
    }
    static incomingChatMessage = (detail, peer) => {
        if (detail.username == "Session") addChatMessage(detail.username, detail.content, sessionColor);
        else addChatMessage(detail.username, detail.content);
    }
    static playerLeft = (detail) => {
        document.querySelector("#player" + detail.id).remove();
        addChatMessage("Session", detail.username + " left the session.", sessionColor);
    }
}