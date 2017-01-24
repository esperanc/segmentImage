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
    segmentMethod : 'palette',
	background : "#ffffff",
	bkgTolerance : 5, 
    segment : function () {
    	segment()
    },
    colors : 16,
    maxColorDist : 128,
    reduceWithinDistance : reduceWithinDistance,
    reduceInconditional : reduceInconditional,
    mergeBackground : mergeBackground,
    mergeBySegmentClass : mergeBySegmentClass,
    layout : 'left-right',
    'shrink-to-fit' : true,

};

function setupGui() {
    var gui = new dat.GUI();
    gui.add (settings, 'uploadImage');
    gui.add (settings, 'colors', 1, 256);
    gui.add (settings, 'segmentMethod', ['palette', 'background'])
    gui.addColor (settings, 'background');
    gui.add (settings, 'bkgTolerance', 0, 255);
    gui.add (settings, 'mergeBackground');
    gui.add (settings, 'mergeBySegmentClass');
    gui.add (settings, 'segment');
    gui.add (settings, 'reduceInconditional');
    gui.add (settings, 'maxColorDist', 1, 256);
    gui.add (settings, 'reduceWithinDistance');
    gui.add (settings, 'layout', ['left-right','top-bottom']);
    gui.add (settings, 'shrink-to-fit');

    // Avoid events on the gui to be passed to the canvas below
    var stop = function (e) {
        e.stopPropagation();
    }
    var events = ['mousedown', 'keypress', 'keydown'];
    var domElement = document.getElementsByTagName("div")[0];
    events.forEach (function (e) {
        domElement.addEventListener (e, stop, false);
    });
    //===
}

var img, imgData, segs, iseg, pal, cutMatrix;
var canvas;
var context;

//
// Given two quadruples rgba, returns their euclidean distance
//
function colorDist (a,b) {
	var d = [a[0]-b[0],a[1]-b[1],a[2]-b[2],a[3]-b[3]];
	return Math.sqrt(d[0]*d[0]+d[1]*d[1]+d[2]*d[2]+d[3]*d[3]);
}

//
// Removes undefined elements of an array
//
function compressArray(a) {
	for (var i = 0; i < a.length; i++) {
		while (i < a.length && a[i] === undefined) a.splice(i,1);
	}
}

// 
// Given an array of segments segs, returns an array of pairs (i,j)
// of segment classes that could be merged. 
//
// Function mergeable (internalCount, externalCount, bestNeighborCount, bestNeighborColorDist)
// should return true if a given segment should be merged with its best neighbor segment, where
// internalCount is the number of internal neighbors (neighbor pixels in the same segment), externalCount
// is the number of external neighbors (neighbor pixels in any different segment), bestNeighborCount
// is the number of neighbor pixels in the most popular other segment and bestNeighborColorDist is
// the euclidean distance between the average color of the segment and its most popular other
// segment.
//
function mergeablePairs (segs, mergeable) {
	// maps each segment segmentClass to the index in segs where they are
	var index = [];
	for (var i = 0; i < segs.length; i++) {
		var c = ~~(segs[i].segmentClass);
		console.assert (index[c] == undefined);
		index[c] = i;
	}
	var pairs = [];
	for (let seg of segs) {
		var neighbors = seg.neighborCount();
		var i = seg.segmentClass;
		var maxcount = 0; // Count of neighbor with largest count
		var sum = 0;      // Total neighbor count
		var jmax = -1;    
		for (var j in neighbors) {
			var n = neighbors[j];
			j = ~~j;
			if (j != i) {
				if (n > maxcount && index[j]) {
					jmax = j;
					maxcount = n;
				}
				sum += n;
			}
		}
		if (jmax == -1) continue;
		console.log (neighbors);
		console.log (i,index[i],jmax,index[jmax]);
		var dist = colorDist(segs[index[i]].avgColor,segs[index[jmax]].avgColor);
		console.log (sum, dist);
		if (mergeable (neighbors[i], sum, maxcount, dist)) {
			pairs.push ({ i:i, j:jmax });
		}
	}
	return pairs;
}

//
// Given an array of segments segs and an array of pairs candidates (i,j) of indices
// for segs, merge all segments segs[j] with segs[i]
//
function reduceSegments (segs, candidates) {
	// maps each segment segmentClass to the index in segs where they are
	var index = [];
	// maps each segment class to the final merged class
	var sClass = {};

	for (var i = 0; i < segs.length; i++) {
		var c = ~~(segs[i].segmentClass);
		sClass[c] = c;
		console.assert (index[c] == undefined);
		index[c] = i;
	}

	// Merge all pairs of segment classes
	for (let pair of candidates) {
		var i = ~~pair.i; 
		while (~~sClass[i] != i) i = ~~sClass[i];
		var j = ~~pair.j;
		while (~~sClass[j] != j) j = ~~sClass[j];
		if (i != j)	{
			console.log ("Merging classes", ~~pair.i, i, "and ", ~~pair.j, j);
			segs[index[i]].merge(segs[index[j]]);
			segs[index[j]] = undefined;
			sClass[j] = i;
			sClass[pair.j] = i;
			sClass[pair.i] = i;
			index[j] = index[i];
		}
	}

	// Find the final class of each original segment class
	var newClass = {};
	for (var c in sClass) {
		var i = ~~c;
		while (~~sClass[i] != i) i = ~~sClass[i];
		newClass[c]=i;
	}
	sClass = newClass;

	compressArray (segs);

	for (var i = 0; i < segs.length; i++) {
		var seg = segs[i];
		var orig = seg.pClass;
		var pClass = function (r,g,b,a) {
			var c = orig(r,g,b,a);
			return sClass[c];
		}
		seg.pClass = pClass;
	}
	console.log (segs);
}


//
// Merge all components that have background color
//
function mergeBackground () {
	// Merge the background components
	var bkgClass = segs[0].segmentClass;
	var merged = [];
	var mergedBkg = null;
	console.log (segs.length + " segments originally");
	for (let seg of segs) {
		var i = seg.segmentClass;
		if (i == bkgClass) {
			if (mergedBkg) mergedBkg.merge (seg);
			else mergedBkg = seg;
		}
		else merged.push (seg);
	}
	merged.push (mergedBkg);
	segs = merged;
	compressArray(segs);
	console.log (segs);
	segmentsToImages();
}


//
// Merge all components by segmentClass
//
function mergeBySegmentClass () {
	var merged = new Array (settings.colors);
	console.log (segs.length + " segments originally");
	for (let seg of segs) {
		var i = seg.segmentClass;
		if (merged[i]) merged[i].merge(seg);
		else merged[i] = seg;
	}
	segs = merged;
	compressArray(segs);
	console.log (segs);	
	segmentsToImages();
}

//
// Performs the segmentation of the loaded image (imgData)
//
function segment () {
	// Color quantize
	var opts = { colors : settings.colors };
	quant = new RgbQuant(opts);
	quant.sample (imgData);
	pal = quant.palette();
	
	var rgba = new Uint8Array(4);
	var rgba32 = new Uint32Array (rgba.buffer);

	// Classifies a pixel according to the quantizer palette
	var classifier = function (r,g,b,a) {
		rgba[0]=r; rgba[1] = g; rgba [2] = b; rgba[3] = a;
		var segClass = quant.nearestIndex(rgba32[0]);
		if (segClass == null) return settings.colors;
		return segClass;
	};
	
	// Classifies two pixels as belonging to different segments
	// according to whether one is background and the other is not
	var bkgColor = color (settings.background);
	bkg = [~~red(bkgColor),
	    	   ~~green(bkgColor),
	           ~~blue(bkgColor), 0];
	count1 = 0;
	count2 = 0;
	backgroundDiff = function (r1,g1,b1,a1,r2,g2,b2,a2) {
		var result =  (colorDist ([r1,g1,b1,0],bkg) <= settings.bkgTolerance) != 
			   (colorDist ([r2,g2,b2,0],bkg) <= settings.bkgTolerance);
	    if (result) count1++;
	    else count2++;
	    return result;
	}

	var diff = settings.segmentMethod == 'palette' ? undefined : backgroundDiff;

	// var classifier = function (r,g,b,a) {
	// 	return a == 0 || (r + g + b >= 128*3); 
	// };

	segs = segmenter (imgData, classifier, diff);

	segmentsToImages();
}


// Merge segments that look like they contain scattered pixels from some 
// antialiased object with the segment closest in color, provided their
// average color are sufficiently similar.
function reduceWithinDistance() {
	var pairs = mergeablePairs(segs, function (internal, external, best, dist) {
		return (dist < settings.maxColorDist && external > internal);
	});
	console.log (pairs);
	reduceSegments (segs, pairs);
	segmentsToImages();
}

// Merge segments that look like they contain scattered pixels from some 
// antialiased object with the segment closest in color.
function reduceInconditional () {
	var pairs = mergeablePairs(segs, function (internal, external, best, dist) {
		return (external > internal);
	});
	console.log ("new pairs", pairs);
	reduceSegments (segs, pairs);
	segmentsToImages();
}

//
// Computes images for all segments in segs
//
function segmentsToImages () {

	for (let seg of segs) {
		seg.img = seg.canvas();
	}
	iseg = 0;
}


function mousePressed () {
	if (segs) {
		iseg ++;
		if (iseg >= segs.length) iseg = 0;
	}
}

function setup() {
	canvas = createCanvas (1000,800).canvas;
	context = canvas.getContext('2d');
	setupGui();
	imageLoaderCallback = function (imgElement) {
		img = imgElement;
		imgData = getImageData (img);
		segment ();
	}
}

var tmp;

function draw() {
	context.fillStyle = settings.background;
	context.fillRect(0,0,width,height);
	if (img) {
		//context.drawImage (img, 0,0);
		var seg = segs[iseg];
		var s = 40, scale = 1.0;
		var sx = img.width, sy = 0, px = 0, py = img.height;
		if (settings.layout != 'left-right') {
			sx = 0;
			sy = img.height;
			py = img.height*2;
			if (py + s > height) {
				scale = (height - s) / py;
			}
		}
		else {
			if (img.width * 2 > width) {
				scale = width / img.width / 2;
			}
		}
		context.drawImage (img, 0, 0, img.width*scale, img.height*scale);
		context.drawImage (seg.img, (sx+seg.x)*scale, (sy+seg.y)*scale, seg.width*scale, seg.height*scale);

		var x = px*scale, y = py*scale;
		for (var i = 0; i < pal.length; i+=4) {
			fill (pal[i],pal[i+1],pal[i+2]);
			if (segs[iseg].segmentClass == i/4) {
				var c = segs[iseg].avgColor;
				stroke (c[0],c[1],c[2]);
				strokeWeight(s/4);
			}
			else {
				noStroke();
			}
			rect (x,y,s,s);
			x += s;
			if (x > img.width) {
				x = px;
				y += s;
			}
		}
	}
}