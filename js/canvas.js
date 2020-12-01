class Canvas {

    // properties and getters
    _element;
    _drawCommands = [];
    _drawActions = [];
    _keyActions = [];
    _snapshots = [];
    _nextSnapshots = [];
    _bufferedCommands = [];
    _bufferedIncomingCommands = [];
    _performedDrawCommands = [];
    _shiftCommandInterval = null;
    peer = null;
    keyOptions;
    brush;
    get element() {
        return this._element;
    }
    get context() {
        return this._element.getContext("2d");
    }
    get width() {
        return this._element.width;
    }
    get height() {
        return this._element.height;
    }
    
    // constructor; set properties and load events
    constructor(width, height, brushMinSize = 3, brushMaxSize = 50,
            keyOptions = { erase: "e", brush: "b", fill: "f", clear: "escape" }) {
        this._element = document.createElement("canvas");
        this._element.id = "canvasDrawing";
        this._element.height = height; 
        this._element.width = width;
        this.clearCanvas();
        this.brush = new Brush(this.element, brushMinSize, brushMaxSize, brushMinSize);
        this.initDrawingHandlers();
        this.element.style.imageRendering = "pixelated";
        this.keyOptions = keyOptions;
    }

    setKeyAction(actionChar, callback) {
        let existing = this._keyActions.find(a => a.char == actionChar);
        if (existing) existing.action = callback;
        else this._keyActions.push({ char: actionChar, action: callback });
    }

    //init events for drawing and tools
    initDrawingHandlers() {

        this.element.addEventListener("pointerdown", this.statechange);
        this.element.addEventListener("pointermove", this.pointermove);
        this.element.addEventListener("pointerup", this.statechange);
        this.element.addEventListener("pointerenter", this.statechange);
        this.element.addEventListener("pointerleave", this.pointerleave);
        this.element.addEventListener("touchmove", this.touchmove);
        document.addEventListener("wheel", this.wheel, { passive: false });
        document.addEventListener("keydown", this.keydown);
    }

    // fires when a brush down state could have occured
    statechange = e => { // udate brush press state, call draw func
        e.preventDefault();
        if (this.updatePointerState(e)) {
            let rect = this.element.getBoundingClientRect();
            this.brush.movePosition(e.clientX - rect.left, e.clientY - rect.top, true);
            this.takeSnapshot();
        }
        if (this.brush.down) this.drawWithPointer(e);
    } 
    // reset vector if pointer leaves canvas
    pointerleave = e => {
        e.preventDefault();
        if(this.brush.down)this.drawWithPointer(e);
        this.brush.down = false;
        //this.takeSnapshot();
    }
    // fires when pointer moves on canvas
    pointermove = e => {
        e.preventDefault();
        if (this.brush.down && this.brush.mode != "fill") this.drawWithPointer(e); // if brush is down, draw
    }
    // prevent windows ink scrolling
    touchmove = e => {
        e.preventDefault();
    } 
    // use wheel to change brush size if mouse over canvas
    wheel = e => {
        if (this.element.matches(":hover")) {
            e.preventDefault();
            if (e.deltaY > 0) this.brush.size+=2;
            else this.brush.size-=2;
        }
    } 
    // detect keydowns and call actions
    keydown = e => {
        this._keyActions.filter(a => a.char.toLowerCase() == e.key.toLowerCase()).forEach(a => a.action());
        switch (e.key.toLowerCase()) {
            case this.keyOptions.clear.toLowerCase():
                this.addDrawCommands([this.createDrawCommandClear()]);
                break;
            case this.keyOptions.brush.toLowerCase():
                this.brush.mode = "brush";
                break;
            case this.keyOptions.erase.toLowerCase():
                this.brush.mode = "erase";
                break;
            case this.keyOptions.fill.toLowerCase():
                this.brush.mode = "fill";
                break;
        }
    }

    // updates the brush down state
    updatePointerState = e => {
        let old = this.brush.down;
        this.brush.down = e.pressure > 0;
        return this.brush.down && !old;
    }
    // draws the mouse vector on the canvas
    drawWithPointer = e => {
        if (this.brush.ink && e.pointerType == "pen") this.brush.size = Math.round(this.brush.sizeMax * e.pressure);
        let rect = this.element.getBoundingClientRect();
        this.brush.movePosition(e.clientX - rect.left, e.clientY - rect.top, false);
        let command = this.getDrawCommand();
        this.addDrawCommands([command]);
        //end.send(messageGenerator.drawcommand(end.id, end._username, command));
    }
    // create a draw command depending on current brush properties
    getDrawCommand() {
        let command;
        switch (this.brush.mode) {
            case "brush":
                 command = this.createDrawCommandDraw(
                     this.brush.color,
                     this.brush.size,
                     this.brush.position.last.x,
                     this.brush.position.last.y,
                     this.brush.position.x,
                     this.brush.position.y
                );
                break;

            case "fill":
                command = this.createDrawCommandFill(
                    this.brush.color,
                    this.brush.position.x,
                    this.brush.position.y
                );
                break;

            case "erase":
                command = this.createDrawCommandErase(
                    this.brush.size,
                    this.brush.position.last.x,
                    this.brush.position.last.y,
                    this.brush.position.x,
                    this.brush.position.y
                );
                break;

            case "pipette":
                break;
        }
        return command;
    }
    // create draw command arrays
    createDrawCommandClear() { return [3]; }
    createDrawCommandFill(color, x, y) { return [2, color, x, y]; }
    createDrawCommandErase(size, x1, y1, x2, y2) { return [1, size, x1, y1, x2, y2]; }
    createDrawCommandDraw(color, size, x1, y1, x2, y2) { return [0, color, size, x1, y1, x2, y2]; }
    takeSnapshot(clear = true) {
        this._snapshots.push(this.element.toDataURL());
        if (this._snapshots.length > 100) this._snapshots.shift();
        if (this._nextSnapshots.length > 100) this._nextSnapshots.shift();
        if(clear)this._nextSnapshots = [];
    }
    lastSnapshot() {
        let snapshot = this._snapshots.pop();
        if (snapshot) {
            this.takeSnapshot(false);
            this.putSnapshot(snapshot);
        }
    }
    nextSnapshot() {
        let snapshot = this._nextSnapshots.pop();
        if (snapshot) {
            this.takeSnapshot(false);
            this.putSnapshot(snapshot);
        }
    }
    putSnapshot(snapshot, incoming = false) {
        if (this.peer) {
            if (this.peer.constructor.name == "Node") {
                this.peer._endConnections.forEach(c => {
                    this.peer.send(messageGenerator.snapshot(this.peer.id, this.peer._username, snapshot), c.id);
                });
            }
            else if (this.peer.constructor.name == "End" && !incoming) {
                alert("End participiants can't set snapshots in a session. \nAsk the node to set one!");
                return;
            }
        }
        let image = new Image;
        image.onload = () => { this.context.drawImage(image, 0, 0); }
        image.src = snapshot;
    }
    addDrawCommands(commands) {
        this._bufferedCommands = [...this._bufferedCommands, ...commands];
        if (!this._shiftCommandInterval) this._shiftCommandInterval = setInterval(this.shiftAndDrawCommand, this.peer? 10 : 0);
    }
    addIncomingDrawCommands(commands) {
        this._bufferedIncomingCommands = [...this._bufferedIncomingCommands, ...commands];
        if (!this._shiftCommandInterval) this._shiftCommandInterval = setInterval(this.shiftAndDrawCommand, this.peer ? 10 : 0);
    }
    shiftAndDrawCommand = () => {
        let cmds = this._bufferedCommands.splice(0, 20);
        if (this.peer) {
            if (cmds && cmds.length) {
                if (this.peer.constructor.name == "Node") {
                    this.peer._endConnections.forEach(c => {
                        this.peer.send(messageGenerator.drawcommand(this.peer.id, this.peer._username, cmds), c.id);
                    })
                }
                else if (this.peer.constructor.name == "End") {
                    this.peer.send(messageGenerator.drawcommand(this.peer.id, this.peer._username, cmds));
                }
            }
        }
        cmds = [...cmds, ...this._bufferedIncomingCommands.splice(0, 20)];
        if (cmds && cmds.length) cmds.forEach(cmd=>this.performDrawCommand(cmd));
        else { clearInterval(this._shiftCommandInterval); this._shiftCommandInterval = null;};
    }
    // execute a draw command on the canvas
    performDrawCommand(command) {
        let mode = command[0];
        let size, x1, x2, y1, y2, color, radius;
        if (mode < 3) this._performedDrawCommands.push(command);
        else this._performedDrawCommands = [];

        switch (mode) {
            case 0: // Brush tool
                size = Math.floor(command[2]);

                radius = Math.floor(Math.ceil(size / 2));
                x1 = this.setNumberBoundaries(Math.floor(command[3]), -radius, this.width + radius);
                y1 = this.setNumberBoundaries(Math.floor(command[4]), -radius, this.height + radius);
                x2 = this.setNumberBoundaries(Math.floor(command[5]), -radius, this.width + radius);
                y2 = this.setNumberBoundaries(Math.floor(command[6]), -radius, this.height + radius);
                color = Brush.getColor(command[1]).rgbValues; 

                this.plotLine(x1, y1, x2, y2, radius, color.r, color.g, color.b);
                break;

            case 1: // Erase tool
                size = Math.floor(command[1]);

                radius = Math.floor(Math.ceil(size / 2));
                x1 = this.setNumberBoundaries(Math.floor(command[2]), -radius, this.width + radius);
                y1 = this.setNumberBoundaries(Math.floor(command[3]), -radius, this.height + radius);
                x2 = this.setNumberBoundaries(Math.floor(command[4]), -radius, this.width + radius);
                y2 = this.setNumberBoundaries(Math.floor(command[5]), -radius, this.height + radius);

                this.plotLine(x1, y1, x2, y2, radius, 255, 255, 255);
                break;

            case 2: // Fill tool
                color = Brush.getColor(command[1]).rgbValues;
                let x = this.setNumberBoundaries(Math.floor(command[2]), -radius, this.width + radius);
                let y = this.setNumberBoundaries(Math.floor(command[3]), -radius, this.height + radius);

                this.floodFill(x, y, color.r, color.g, color.b);
                break;

            case 3: // clear
                this.clearCanvas();
                break;
        }
    }
    // remove canvas contents
    clearCanvas() {
        this.context.fillStyle = "white";
        this.context.fillRect(0, 0, this.width, this.height);
    }
    // returns a value checked for given boundaries
    setNumberBoundaries(number, boundaryMin, boundaryMax) {
        return number > boundaryMax ? boundaryMax : number < boundaryMin ? boundaryMin : number;
    }
    // manipulates canvas image data to create a line between two points, consisting of single dots
    plotLine(x1, y1, x2, y2, radius, r, g, b) {
        radius = Math.floor(radius);
        let squareArea = radius * radius;
        let outerCoordinates = {
            x1: Math.min(x1, x2) - radius,
            y1: Math.min(y1, y2) - radius,
            x2: Math.max(x1, x2) + radius,
            y2: Math.max(y1, y2) + radius
        }
        let radiuses = {
            rx1: x1 - outerCoordinates.x1, 
            ry1: y1 - outerCoordinates.y1,
            rx2: x2 - outerCoordinates.x1, 
            ry2: y2 - outerCoordinates.y1
        }
        let currentImageData = this.getImageData(
            outerCoordinates.x1,
            outerCoordinates.y1,
            outerCoordinates.x2,
            outerCoordinates.y2
        );
        let drawPoint = (pX, pY) => {
            for (let outerY = -radius; outerY <= radius; outerY++) {
                for (let outerX = -radius; outerX <= radius; outerX++) {
                    if (outerX * outerX + outerY * outerY < squareArea) {
                        let dataIndex = 4 * ((pY + outerX) * currentImageData.width + pX + outerY);
                        if (dataIndex > 0 && dataIndex < currentImageData.data.length) {
                            currentImageData.data[dataIndex] = r;
                            currentImageData.data[dataIndex + 1] = g;
                            currentImageData.data[dataIndex + 2] = b;
                            currentImageData.data[dataIndex + 3] = 255; // alpha
                        }
                    }
                }
            }
        }

        if (radiuses.rx1 == radiuses.rx2 && radiuses.ry1 == radiuses.ry2) // if draw command can be fulfilled with two points
            drawPoint(radiuses.rx1, radiuses.ry1);
        else { // else move points successively towards each and draw endpoints
            drawPoint(radiuses.rx1, radiuses.ry1);
            drawPoint(radiuses.rx2, radiuses.ry2);
            let rxdiff = Math.abs(radiuses.rx2 - radiuses.rx1); // x & y distances between outer points
            let rydiff = Math.abs(radiuses.ry2 - radiuses.ry1); 
            let directionX = radiuses.rx1 < radiuses.rx2 ? 1 : -1; // directions in which the points have to be moved
            let directionY = radiuses.ry1 < radiuses.ry2 ? 1 : -1;
            let rdiff = rxdiff - rydiff;

            while (radiuses.rx1 != radiuses.rx2 || radiuses.ry1 != radiuses.ry2) { // while points are not equal
                let doublediff = rdiff << 1;
                if (doublediff > -rydiff) { rdiff -= rydiff; radiuses.rx1 += directionX; }
                if (doublediff < rxdiff) { rdiff += rxdiff; radiuses.ry1 += directionY; }
                drawPoint(radiuses.rx1, radiuses.ry1);
            }
        }
        this.context.putImageData(currentImageData, outerCoordinates.x1, outerCoordinates.y1);
    }
    floodFill(x, y, r, g, b) {
        let currentImageData = this.getImageData(0, 0, this.width, this.height);
        let coordinates = [[x, y]]; // coordinates to check wether pixel beneath should be filled
        let floodColor = this.getPixel(currentImageData, x, y); // color to flood with
        if (r != floodColor[0] || g != floodColor[1] || b != floodColor[2]) {
            let width = this.width;
            let height = this.height;
            let isFloodColor = dataIndex => { // check if a pixel is of the color which hast to get flooded
                let iR = currentImageData.data[dataIndex], iG = currentImageData.data[dataIndex + 1], iB = currentImageData.data[dataIndex + 2];
                if (iR == r && iG == g && iB == b) return false;
                let diffR = Math.abs(iR - floodColor[0]), diffG = Math.abs(iG - floodColor[1]), diffB = Math.abs(iB - floodColor[2]);
                return diffR < 1 && diffG < 1 && diffB < 1;
            };
            let indexByCoord = (x, y) => {
                return 4 * (y * height + x);
            }
            while (coordinates.length) { // while pixels to fill are present
                let fillCoordinate = coordinates.pop();
                let coordX = fillCoordinate[0], coordY = fillCoordinate[1]; 
                let dataIndex = 4 * (coordY * width + coordX);
                let up, down;

                while (coordY-- >= 0 && isFloodColor(dataIndex)) dataIndex -= 4 * width; // get highest fill pixel
                dataIndex += 4 * width;
                ++coordY;
                up = !1;
                down = !1;
                //this.setPixel(currentImageData,dataIndex, 255, 0, 0); // fill it

                while (coordY++ < height - 1 && isFloodColor(dataIndex)) {
                    this.setPixel(currentImageData, dataIndex, r, g, b);
                    if (coordX > 0) {
                        if (isFloodColor(dataIndex - 4)) {
                            if (!up) {
                                coordinates.push([coordX - 1, coordY]);
                                up = !0;
                            }
                            else if (up) up = !1;
                        }
                    }
                    if (coordX < width -1) {
                        if (isFloodColor(dataIndex + 4)) {
                            if (!down) {
                                coordinates.push([coordX + 1, coordY]);
                                down = !0;
                            }
                            else if (down) down = !1;
                        }
                    }
                    dataIndex += 4 * width;
                }
            }
            this.context.putImageData(currentImageData, 0, 0);
        }
    }
    getPixel(imageData, x, y) {
        let dataIndex = 4 * (y * imageData.width + x);
        return dataIndex >= 0 && dataIndex < imageData.data.length ?
            [imageData.data[dataIndex], imageData.data[dataIndex + 1], imageData.data[dataIndex + 2]] :
            [0, 0, 0];
    }
    setPixel(imageData, dataIndex, r, g, b) {
        if (dataIndex >= 0 && dataIndex < imageData.data.length) {
            imageData.data[dataIndex] = r;
            imageData.data[dataIndex+1] = g;
            imageData.data[dataIndex+2] = b;
            imageData.data[dataIndex+3] = 255;
        }
    }
    getImageData(x1, y1, x2, y2) {
        let cooridnates = {
            x1: Math.min(x1, x2),
            y1: Math.min(y1, y2),
            x2: Math.max(x1, x2),
            y2: Math.max(y1, y2)
        };
        return this.context.getImageData(cooridnates.x1, cooridnates.y1, cooridnates.x2 - cooridnates.x1, cooridnates.y2 - cooridnates.y1);
    }
}

// class to handle current canvas brush states
class Brush {
    // skribbl standard colors
    static standardColors = [
        { "index": 0, "color": "rgb(255, 255, 255)" },
        { "index": 2, "color": "rgb(193, 193, 193)" },
        { "index": 4, "color": "rgb(239, 19, 11)" },
        { "index": 6, "color": "rgb(255, 113, 0)" },
        { "index": 8, "color": "rgb(255, 228, 0)" },
        { "index": 10, "color": "rgb(0, 204, 0)" },
        { "index": 12, "color": "rgb(0, 178, 255)" },
        { "index": 14, "color": "rgb(35, 31, 211)" },
        { "index": 16, "color": "rgb(163, 0, 186)" },
        { "index": 18, "color": "rgb(211, 124, 170)" },
        { "index": 20, "color": "rgb(160, 82, 45)" },
        { "index": 1, "color": "rgb(0, 0, 0)" },
        { "index": 3, "color": "rgb(76, 76, 76)" },
        { "index": 5, "color": "rgb(116, 11, 7)" },
        { "index": 7, "color": "rgb(194, 56, 0)" },
        { "index": 9, "color": "rgb(232, 162, 0)" },
        { "index": 11, "color": "rgb(0, 85, 16)" },
        { "index": 13, "color": "rgb(0, 86, 158)" },
        { "index": 15, "color": "rgb(14, 8, 101)" },
        { "index": 17, "color": "rgb(85, 0, 105)" },
        { "index": 19, "color": "rgb(167, 85, 116)" },
        { "index": 21, "color": "rgb(99, 48, 13)" }
    ];

    //interpret a color code
    static getColor(code) { // Code below 10000 => Color index; Above 1000 => hex code
        let color;
        if (code < 10000) color = new Color({ rgb: this.standardColors.find(c => c.index == code).color });
        else color = new Color({ hex: "#" + ("000000" + (code - 10000).toString(16)).slice(-6) });
        return color;
    }
    static getCode(color) { 
        let standard = Brush.standardColors.find(c => (new Color({ rgb: c.color })).hex == color.hex);
        if (standard) return standard.index;
        let val = parseInt(color.hex.substring(1), 16) + 10000;
        return val;
    }

    // diverse drawing properties
    ink = true;
    _mode = "brush";
    down = false;
    _color;
    position; 
    sizeMin;
    sizeMax;
    _size;
    canvasElement;

    constructor(canvas, sizemin = 3, sizemax = 50, initsize = 10, initcolor = 1) {
        this.canvasElement = canvas;
        this.position = { x: null, y: null, last: { x: null, y: null } };
        this.sizeMin = sizemin;
        this.sizeMax = sizemax;
        this._color = initcolor;
        this._size = initsize;
        this.updateCursor();
    }

    // size getter and setter
    get size() { return this._size; }
    set size(val) {
        this._size = this.sizeMin > val ? this.sizeMin : val > this.sizeMax ? this.sizeMax : val;
        this.updateCursor();
    }

    get color() { return this._color; }
    set color(value) {
        this._color = value;
        this.updateCursor();
    }

    get mode() { return this._mode; }
    set mode(value) {
        this._mode = value;
        this.updateCursor();
    }

    updateCursor() {
        if (this.mode == "brush" || this.mode == "erase") {
            let diameter = this.size < 5 ? 5 : this.size;
            let cursor =
                '<svg xmlns="http://www.w3.org/1999/xhtml" height="' + diameter + '" width="' + diameter + '">' +
                "<circle cx='50%' cy='50%' r='48%' stroke='black' stroke-width='2%' fill='" +
                (this.mode == "brush" ? Brush.getColor(this.color).rgb : "rgb(255,255,255)") +
                "'></circle> </svg>";
            let parent = document.createElement("div");
            parent.innerHTML = cursor;
            let imgdata = btoa(new XMLSerializer().serializeToString(parent.firstChild));
            this.canvasElement.style.cursor = "url(data:image/svg+xml;base64," + imgdata + ") " + diameter / 2 + " " + diameter / 2 + ", auto";
        }
        else if (this.mode == "fill") {
            this.canvasElement.style.cursor = "url(https://skribbl.io/res/fill_graphic.png) 7 38, default";
        }
    }

    // set the mouse move vector
    movePosition(newX, newY, clearOld = false) {
        if (clearOld || this.position.x == null || this.position.y == null) {
            this.position.x = this.position.last.x = newX;
            this.position.y = this.position.last.y = newY;
        }
        else {
            this.position.last.x = this.position.x;
            this.position.last.y = this.position.y;
            this.position.x = newX;
            this.position.y = newY;
        }
    }
}

// class to simplify color conversions
class Color {
    _r;
    _g;
    _b;
    get r() { return this._r; }
    get g() { return this._g; }
    get b() { return this._b; }
    // get the rgb string of the color
    get rgb() { return "rgb(" + [this._r, this._g, this._b].join(",") + ")"; }
    // get the rgb values of the color
    get rgbValues() { return { r: this._r, g: this._g, b: this._b }; }
    // get the hex string of the color
    get hex() { return "#" + this._r.toString(16).padStart(2, "0") + this._g.toString(16).padStart(2, "0") + this._b.toString(16).padStart(2, "0"); }
    constructor(color) {
        // create a color by hex val
        if (color.hex) {
            let hex = color.hex;
            if (hex[0] == '#') hex = hex.substring(1);
            this._r = parseInt("0x" + hex.substring(0, 2));
            this._g = parseInt("0x" + hex.substring(2, 4));
            this._b = parseInt("0x" + hex.substring(4, 6));
        }
        // create a color by single r, g and b values
        else if (color.r && color.g && color.b) {
            this._r = color.r;
            this._g = color.g;
            this._b = color.b;
        }
        else if (color.rgb) {
            // create a color by rgb string
            let rgb = color.rgb.trim().replace(" ", "").split(",");
            this._r = parseInt(rgb[0].replace(/[^\d]/g, ''), 10);
            this._g = parseInt(rgb[1].replace(/[^\d]/g, ''), 10);
            this._b = parseInt(rgb[2].replace(/[^\d]/g, ''), 10);
        }
    };
}

