﻿// ################
// Define constants
// ################
const titleSize = { w: 1000, h: 600 };
const systemColor = new Color({ hex: "#133f8c" });
const errorColor = new Color({ hex: "#ff0000" });
const sessionColor = new Color({ hex: "#037d14" });

// ###########################
// Generic re-usable functions
// ###########################
let setTitleCanvas = (w, h, titleContainer, canvasContainer) => {
    let titlecanvas = new Canvas(w, h, null, 10, 10, { erase: "", brush: "", fill: "", clear: "" });
    canvasContainer.appendChild(titlecanvas.element);
    canvasContainer.style.height = titlecanvas.height + "px";
    canvasContainer.style.width = titlecanvas.width + "px";
    titleContainer.style.marginTop = titlecanvas.height / 2 + "px";
    titleContainer.style.width = titlecanvas.width + "px";
    titlecanvas.addDrawCommands(title);
    return titlecanvas;
}

let setSessionInfo = (code, height, width, admin) => {
    document.querySelector("#containerSessionInfo").innerHTML = "🔗 ID: <br> - " + code + "<br>🖼️ Size: <br> - " + height + " x " + width + "<br>👑 Owner: <br> - " + admin;
}

let addOrUpdateLobbyPlayer = (peerID, playername, avatarDataURL, admin = false) => {
    let containerSession = document.querySelector("#containerSession");
    let player = document.createElement("div");
    player.classList.add("playerContainer","flex", "flex--row");
    let avatar = document.createElement("img");
    avatar.src = avatarDataURL;
    let name = document.createElement("span");
    name.innerHTML = playername + (admin ? " ~ 👑" : "") ;
    player.id = "player" + peerID;
    player.appendChild(avatar);
    player.appendChild(name);
    let existing = document.querySelector("#" + player.id);
    if (existing) existing = player;
    else containerSession.appendChild(player);
}

let setAvatarCanvas = (replaceCanvas) => {
    let canvasAvatar = new Canvas(150, 150, null, 10, 10, { erase: "e", brush: "b" }, "canvasCreateAvatar");
    replaceCanvas.replaceWith(canvasAvatar.element);
    canvasAvatar.element.style = "border: 2px solid black; border-radius:5px;";
    return canvasAvatar;
}

let setGameCanvas = (w, h, canvasContainer) => {
    let canvasgame = new Canvas(w, h, pickerBtn);
    canvasContainer.querySelector("#canvasDrawing").remove();
    canvasContainer.appendChild(canvasgame.element);
    canvasContainer.style.height = h + "px";
    canvasContainer.style.width = w + "px";
    canvasgame.setKeyAction("Z", () => { canvas.lastSnapshot(); });
    canvasgame.setKeyAction("Y", () => { canvas.nextSnapshot(); });
    let setActiveTool = (tool) => {
        document.querySelectorAll("#modes > .tool").forEach(t => t.classList.remove("tool--selected"));
        tool.classList.add("tool--selected");
    }
    document.querySelector(".tool--pen").addEventListener("pointerdown", (e) => { canvas.brush.mode = "brush"; setActiveTool(e.target); });
    document.querySelector(".tool--fill").addEventListener("pointerdown", (e) => { canvas.brush.mode = "fill"; setActiveTool(e.target);});
    document.querySelector(".tool--erase").addEventListener("pointerdown", (e) => { canvas.brush.mode = "erase"; setActiveTool(e.target); });
    document.querySelector(".tool--pipette").addEventListener("pointerdown", (e) => { canvas.brush.mode = "pipette"; setActiveTool(e.target); });
    return canvasgame;
}

let addChatMessage = (sender, message, sendercolor = new Color({ hex: "#000000" }), messagecolor = null) => {
    let container = document.createElement("div");
    container.innerHTML = message;
    let sanitized = container.textContent;
    container.innerHTML = "";
    container.innerHTML = `<div class="content"> <span style="color:${sendercolor.hex}">${sender}:</span>${sanitized}</div>`;
    if (messagecolor && message.constructor.name == "Color") container.style.background = messagecolor.hex;
    container.className = "message";
    document.querySelector("#containerMessages").appendChild(container);
    container.scrollIntoView();
}

let addChatError = (error) => {
    let msg = "";
    switch (error.name) {
        case "sessionMissing":
            msg = "You didn't enter a session code.";
            break;
        case "usernameMissing":
            msg = "You didn't enter a name.";
            break;
        default:
            msg = "An unknown error occured :c " + error;
    }
    addChatMessage("Error", msg, errorColor);
}

let setPickerButton = (pickerElement, canvasElement) => {
    //pickerBtn.style.display = "none";
    //canvasElement.element.parentElement.appendChild(pickerBtn);
    let picker = new ColorPicker(pickerElement);
    pickerBtn.addEventListener("colorChange", (e) => {
        canvas.brush.color = Brush.getCode(new Color({ hex: e.detail.color.hex }));
    });
    showpicker = () => { pickerBtn.dispatchEvent(new CustomEvent("click")); canvasElement.setKeyAction("AltGraph", hidepicker); };
    hidepicker = () => { document.querySelector("#color_picker_bg").dispatchEvent(new CustomEvent("click")); canvasElement.setKeyAction("AltGraph", showpicker); };
    canvasElement.setKeyAction("AltGraph", showpicker);
    return picker;
}

let initSliders = () =>{
    document.querySelectorAll("input[type='range']").forEach(s => {
        s.addEventListener("input", e => {
            e.target.parentElement.querySelector("span").textContent = e.target.value + "px";
        })
    });
}

let ifNotThen = (val1, val2) => { return val1 ? val1 : val2;}


// ############################################################
// Defining element & game variables and adding event listeners
// ############################################################

let createSession = document.querySelector("#createSession");
let sessionCode = document.querySelector("#sessionCode");
let joinSession = document.querySelector("#joinSession");
let titleScreen = document.querySelector("#title");
let loginName = document.querySelector("#loginName");
let canvasContainer = document.querySelector("#containerCanvas");
let canvas;
let canvasAvatar;
let pickerBtn = document.querySelector(".tool--mag");
let picker = null;
let peer = null;
let showpicker;
let hidepicker;
createSession.addEventListener("click", () => {
    try {
        peer = new Node(loginName.value, canvasAvatar.element.toDataURL("2d"));
    }
    catch(e){
        addChatError(e);
        return;
    }
    peer.events.addEventListener("create", e => {
        addChatMessage("System", `Session with id ${e.detail.id} created.`, systemColor);
        canvas = setGameCanvas(document.querySelector("#createWidth").value, document.querySelector("#createHeight").value, canvasContainer);
        picker = setPickerButton(pickerBtn, canvas);
        peer.canvasProperties = { height: canvas.height, width: canvas.width };
        canvas.peer = peer;
        titleScreen.style.display = "none";
        setSessionInfo(e.detail.id, canvas.height, canvas.width, peer.username);
        addOrUpdateLobbyPlayer(peer.id, peer.username, canvasAvatar.element.toDataURL("2d"), true);
    });
    peer.events.addEventListener("connect", e => {
        addChatMessage("System", `End with username ${e.detail.username} connected to session.`, systemColor);
        canvas.takeSnapshot(false);
        canvas.lastSnapshot();
    });
});
joinSession.addEventListener("click", () => {
    try {
        peer = new End(sessionCode.value.trim(), loginName.value.trim(), canvasAvatar.element.toDataURL("2d"));
    }
    catch (e) {
        addChatError(e);
        return;
    }
    peer.events.addEventListener("connect", e => {
        addChatMessage("System",`Connected to session with node username ${e.detail.username}.`, systemColor);
        canvas = setGameCanvas(e.detail.canvasHeight, e.detail.canvasWidth, canvasContainer);
        picker = setPickerButton(pickerBtn, canvas);
        canvas.peer = peer;
        titleScreen.style.display = "none";
        peer.send(messageGenerator.lobbyPlayer(peer.id, peer.username, peer.avatarData, false));
    });
});

document.querySelector("#inputChat").addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        let content = document.activeElement.value;
        if (canvas.peer) {
            if (canvas.peer.constructor.name == "Node") {
                let msg = messageGenerator.chatMessageCreated(canvas.peer.id, canvas.peer.username, content);
                ConnectionHandler.chatMessageCreated(msg.detail, canvas.peer);
            }
            else canvas.peer.send(messageGenerator.chatMessageCreated(canvas.peer.id, canvas.peer.username, content));
        }
        else addChatMessage(ifNotThen(loginName.value, "You"), content);
        document.activeElement.value = "";
    }
});

// ###########################
// Run when document is loaded
// ###########################

document.addEventListener("DOMContentLoaded", () => {
    canvas = setTitleCanvas(titleSize.w, titleSize.h, titleScreen, canvasContainer);
    canvasAvatar = setAvatarCanvas(document.querySelector("#canvasAvatar"));
    addChatMessage("System", "Welcome! <3", systemColor);
    addChatMessage("System", "Create a session or enter a session code to join someone!", systemColor);
    initSliders();
});
