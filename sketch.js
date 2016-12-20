// Image upload stuff
var imageLoader = document.getElementById('imageLoader');
var imageLoaderCallback = null; // Fill this to do something on image upload
function handleImage(e){
    var reader = new FileReader();
    reader.onload = function(event){
        var img = new Image();
        img.onload = function(){
            if (imageLoaderCallback) {
            	imageLoaderCallback (img);
            }
            // clear the input element so that a new load on the same file will work
            e.target.value = "";
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);     
}
imageLoader.addEventListener('change', handleImage, false);


// Gets the pixels from an image element
var getImageData = function (img) {
	var canvas = document.createElement('canvas');
	canvas.setAttribute ('width', img.width);
	canvas.setAttribute ('height', img.height);
	var context = canvas.getContext('2d');
	context.drawImage (img, 0, 0);
	var data = context.getImageData (0,0,img.width,img.height);
	return data;
}

// GUI stuff
var settings = {
	uploadImage: function () {
        imageLoader.click();
    },
};

function setupGui() {
    var gui = new dat.GUI();
    gui.add (settings, 'uploadImage');
}

var img, segs, iseg;
var canvas;
var context;

function mousePressed () {
	if (segs) {
		iseg ++;
		if (iseg >= segs.length) iseg = 0;
	}
}

function setup() {
	canvas = createCanvas (600,400).canvas;
	context = canvas.getContext('2d');
	setupGui();
	imageLoaderCallback = function (imgElement) {
		img = imgElement;
		var data = getImageData (img);

		// Color quantize
		var opts = { colors : 4 };
		var quant = new RgbQuant(opts);
		quant.sample (data);
		var pal = quant.palette();
		//var reduce = quant.reduce (data,2);

		var rgba = new Uint8Array(4);
		var rgba32 = new Uint32Array (rgba.buffer);

		var quantClassifier = function (r,g,b,a) {
			rgba[0]=r; rgba[1] = g; rgba [2] = b; rgba[3] = a;
			return quant.nearestColor(rgba32);
		};
		
		var classifier = function (r,g,b,a) {
			return a == 0 || (r + g + b >= 128*3); 
		};

		var rg = segmenter (data, quantClassifier);
		var comps = rg.connectedComponents();
		segs = rg.segmentedImages(data);
		iseg = 0;
		console.log (segs);
	}
}

function draw() {
	background (200);
	if (img) {
		context.drawImage (img, 0,0);
		var seg = segs[iseg];
		context.drawImage (seg, img.width + seg.x0, seg.y0);
	}
}