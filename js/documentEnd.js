const titleSize = { w: 1000, h: 600 };

let setTitleCanvas = (w, h, titleContainer, canvasContainer) => {
    let titlecanvas = new Canvas(w, h, 5, 5, { erase: "", brush: "", fill: "", clear: "" });
    canvasContainer.appendChild(titlecanvas.element);
    canvasContainer.style.height = titlecanvas.height + "px";
    canvasContainer.style.width = titlecanvas.width + "px";
    titleContainer.style.marginTop = titlecanvas.height / 2 + "px";
    titleContainer.style.width = titlecanvas.width + "px";
    titlecanvas.addDrawCommands(title);
    return titlecanvas;
}

let setGameCanvas = (w, h, canvasContainer) => {
    let canvasgame = new Canvas(w, h);
    canvasContainer.querySelector("canvas").remove();
    canvasContainer.appendChild(canvasgame.element);
    canvasgame.setKeyAction("Z", () => { canvas.lastSnapshot(); });
    canvasgame.setKeyAction("Y", () => { canvas.nextSnapshot(); });
    return canvasgame;
}

let setPickerButton = (pickerElement, canvasElement) => {
    pickerBtn.style.display = "none";
    canvasElement.element.parentElement.appendChild(pickerBtn);
    let picker = new ColorPicker(pickerElement);
    pickerBtn.addEventListener("colorChange", (e) => {
        canvas.brush.color = Brush.getCode(new Color({ hex: e.detail.color.hex }));
    });
    let showpicker = () => { pickerBtn.dispatchEvent(new CustomEvent("click")); canvasElement.setKeyAction(" ", hidepicker); };
    let hidepicker = () => { document.querySelector("#color_picker_bg").dispatchEvent(new CustomEvent("click")); canvasElement.setKeyAction(" ", showpicker); };
    canvasElement.setKeyAction(" ", showpicker);
    return picker;
}

let createSession = document.querySelector("#createSession");
createSession.addEventListener("click", () => {
    peer = new Node(loginName.value);
    peer.events.addEventListener("create", e => {
        alert(`Session with id ${e.detail.id} created.`);
        canvas = setGameCanvas(titleSize.w, titleSize.h, canvasContainer);
        picker = setPickerButton(pickerBtn, canvas);
        canvas.peer = peer;
        titleScreen.style.display = "none";
    });
    peer.events.addEventListener("connect", e => {
        alert(`End with username ${e.detail.username} connected to session.`);
        canvas.takeSnapshot(false);
        canvas.lastSnapshot();
    });
});

let sessionCode = document.querySelector("#sessionCode");
let joinSession = document.querySelector("#joinSession");
joinSession.addEventListener("click", () => {
    peer = new End(sessionCode.value, loginName.value);
    peer.events.addEventListener("connect", e => {
        alert(`Connected to session with host username ${e.detail.username}.`);
        canvas = setGameCanvas(titleSize.w, titleSize.h, canvasContainer);
        picker = setPickerButton(pickerBtn, canvas);
        canvas.peer = peer;
        titleScreen.style.display = "none";
    });
});


let titleScreen = document.querySelector("#title");
let loginName = document.querySelector("#loginName");
let canvasContainer = document.querySelector("#containerCanvas");
let canvas;
let pickerBtn = document.createElement("button");
let picker = null;
let peer = null;
document.addEventListener("DOMContentLoaded", () => {
    canvas = setTitleCanvas(titleSize.w, titleSize.h, titleScreen, canvasContainer);
});
