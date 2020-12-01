class Node {
    events = document.createElement("div");
    _endConnections = [];
    _peer;
    _username;
    get id() {
        return this._peer.id;
    }
    constructor(username) {
        if (!username) throw new Error("No username provided.");
        this._username = username;
        this._peer = new Peer();
        this._peer.on("open",() => {
            this._peer.on("connection", this.onconnect);
            console.log(`Opened node with id ${this.id}.\nWaiting for end peers.`);
            this.events.dispatchEvent(new CustomEvent("create", { detail: { id: this.id } }));
        });
    }

    onconnect = connection => {
        console.log(`Node ${connection.peer} requested connection...`);
        this._endConnections.push({ id: connection.connectionId, connection: connection });
        connection.on("data", (data) => { ConnectionHandler.ondata(data, this, false); });
        setTimeout(() => {
            this.send(messageGenerator.connect(this._peer.id, this._username), connection.connectionId);
        }, 400);
    }

    send = (data, id) => {
        let end = this._endConnections.find(e => e.id == id);
        end.connection.send(data);
    }
}

class End {
    events = document.createElement("div");
    _peer;
    _nodeConnection;
    _nodeID;
    _username;
    get id() {
        return this._peer.id;
    }
    constructor(nodeID, username) {
        if (!username) throw new Error("No username provided.");
        this._username = username;
        if (!nodeID) throw new Error("No node ID provided.");
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
    connected: (endID, username) => { return { event: "connected", id: endID, detail: { username: username, id: endID} }; },
    connect: (endID, username) => { return { event: "connect", id: endID, detail: { username: username, id: endID } }; },
    drawcommand: (endID, username, commands) => { return { event: "drawcommand", id: endID, detail: { username: username, id: endID, commands: commands } }; },
    snapshot: (endID, username, snapshot) => { return { event: "snapshot", id: endID, detail: { username: username, id: endID, snapshot: snapshot } }; },
}

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
        }
    }

    static connect = (detail, peer) => {
        console.log(`Node ${detail.id} with username ${detail.username} accepted the connection.`);
        peer.send(messageGenerator.connected(peer._peer.id, peer._username), detail.id);
        peer.events.dispatchEvent(new CustomEvent("connect", { detail: detail }));
    }
    static connected = (detail, peer) => {
        console.log(`Connected to end ${detail.id} with username ${detail.username}.`);
        peer.events.dispatchEvent(new CustomEvent("connect", { detail: detail }));
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
}