// Represents a raster graph for
// a rectangular array of pixels (image) of width w and height h
var RasterGraph = function (w,h) {
  
	var n = w*h;
	var m = new Uint8Array (n);

	var self = {width:w, height:h, cuts:0, m:m}; // Encapsulates this instance

	// Each byte in m represents a pixel (x,y)
	// where bit 1 tells whether it is
	// connected with pixel on the right (x+1)
	// and bit 2 tells whether it is connected
	// with pixel below (y+1).
  	for (var i = 0; i < n; i++) m [i] = 3;
    for (var i = 0; i < h; i++) m [i*w+w-1] &= ~1;
    for (var i = 0; i < w; i++) m [i+n-w] &= ~2;
  
  
	// Clears the edge between pixel px, py and qx, qy
  	// (must be 4-neighbors)
  	self.cutEdge = function (px, py, qx, qy) {
  		//console.assert ((Math.abs(px-qx) == 1) != (Math.abs (py-qy) == 1));
    	if (px == qx) {
      		//console.assert (px >= 0 && px < w);
      		if (qy > py) m [px+py*w] &= ~2;
      		else  m [qx+qy*w] &= ~2;
    	} 
    	else {
      		// console.assert (py >= 0 && py < h);
      		if (qx > px) m [px+py*w] &= ~1;
      		else  m [qx+qy*w] &= ~1;
    	}
	};
  
	// Returns true if edge between pixel px, py and qx, qy
	// (must be 4-neighbors) exists
	self.getEdge = function (px, py, qx, qy) {
  		//console.assert ((Math.abs(px-qx) == 1) != (Math.abs (py-qy) == 1));
    	if (px == qx) {
      		//console.assert (px >= 0 && px < w);
      		if (qy > py) return m [px+py*w] & 2;
      		else  return m [qx+qy*w] & 2;
    	} 
    	else {
      		// console.assert (py >= 0 && py < h);
      		if (qx > px) return m [px+py*w] & 1;
      		else  return m [qx+qy*w] & 1;
    	}
	};
  
	// Returns true if edge connecting px,py to its right neighbor
	// exists
	self.getEastEdge = function (px, py) {
		return m [px+py*w] & 1;
	};

	// Cuts edge connecting px,py to its right neighbor
	self.cutEastEdge = function (px, py) {
		self.cuts++;
		m [px+py*w] &= ~1;
	};

  
	// Returns true if edge connecting px,py to its below neighbor
	// exists
	self.getSouthEdge = function (px, py) {
		return m [px+py*w] & 2;
	};

	// Cuts edge connecting px,py to its neighbor below
	self.cutSouthEdge = function (px, py) {
		self.cuts++;
		m [px+py*w] &= ~2;
	};

	// Returns a list of connected components of this graph. 
	// Each connected component is an array of addresses (indices) of m
	self.connectedComponents = function () {
		var flag = new Int8Array(n);
		for (var i = 0; i < n; i++) flag[i]=1;
		
		var visit = function (i) {
			var comp = [];
			var stack = [i];
			while (stack.length) {
				i = stack.pop();
				if (flag[i]) {
					flag[i] = 0;
					comp.push (i);
					if (i - w >= 0 && flag[i-w] && (m[i-w] & 2)) {
						stack.push (i-w);
					}
					if (i + w < n && flag[i+w] && (m[i] & 2)) {
						stack.push (i+w);
					}
					if (i%w != 0 && flag[i-1] && (m[i-1] & 1)) {
						stack.push (i-1);
					}
					if ((i+1)%w != 0 && flag[i+1] && (m[i] & 1)) {
						stack.push (i+1);
					}
				}
			}
			return comp;
		}

		var comps = [];
		for (var i = 0; i < n; i++) {
			if (flag[i]) comps.push (visit(i));
		}
		return comps;
	};

	return self;
};

// Represents a connected component (segment) of imgdata (an canvasImageData object)
// Comp is an array of pixel indices by sampling.
// pixels from imgdata. Pclass is a function that takes
// r,g,b,a as an argument and returns the segmentation class for the first pixel
// in the component (in theory, all pixels of the component have the same class).
function Segment (comp, imgdata, pclass) {

	var data = imgdata.data;
	var dataArray = new Uint32Array (data.buffer);
	var w = imgdata.width;
	var avgColor = [0,0,0,0];
	var colorFreq = {};
	var mostFreq = null;
	var topFreq = 0;
	var xy = comp [0];
	var i = xy*4;
	var r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
	this.pClass = pclass;
	var minColor = [r,g,b,a];
	var maxColor = [r,g,b,a];
	var x0 = xy % w, x1 = x0;
	var y0 = ~~(xy / w), y1 = y0;
	for (let xy of comp) {
		var x = xy % w;
		var y = ~~(xy / w);
		if (x < x0) x0=x;
		if (x > x1) x1=x;
		if (y < y0) y0=y;
		if (y > y1) y1=y;
		var i = xy*4;
		var color = dataArray[xy];
		if (color in colorFreq) colorFreq[color]++;
		else colorFreq[color] = 1;
		if (colorFreq[color] > topFreq) {
			topFreq = colorFreq[color];
			mostFreq = xy;
		}
		for (var k = 0; k < 4; k++) {
			var val = data[i+k];
			minColor [k] = Math.min(val,minColor[i]);
			maxColor [k] = Math.max(val,maxColor[i]);
			avgColor [k] += val;
		}
	}
	var n = comp.length;
	this.avgColor = [~~(avgColor[0]/n), ~~(avgColor[1]/n), ~~(avgColor[2]/n), ~~(avgColor[3]/n)],
	this.minColor = minColor;
	this.maxColor = maxColor;
	//this.segmentClass = pclass(this.avgColor[0],this.avgColor[1],this.avgColor[2],this.avgColor[3]);
	i = mostFreq*4;
	this.segmentClass = pclass(data[i], data[i+1], data[i+2], data[i+3]);
	this.comp = comp;
	this.imgdata = imgdata;
	this.x = x0;
	this.y = y0;
	this.width = x1-x0+1;
	this.height = y1-y0+1;
	this.compCount = 1;
}

// Returns a canvas(image) for the component. The canvas object is
// augmented with fields x0 and y0 which contain the offset of the 
// upper left corner of the result w.r.t. original imagedata.
Segment.prototype.canvas = function () {
	var sw = this.width, sh = this.height, ns = sh*sh;
	var x0 = this.x, y0 = this.y;
	var canvas = document.createElement('canvas');
	canvas.setAttribute ('width', sw);
	canvas.setAttribute ('height', sh);
	var ctx = canvas.getContext('2d');
	var seg = ctx.getImageData(0,0,sw,sh);
	var src = new Uint32Array (this.imgdata.data.buffer);
	var dst = new Uint32Array (seg.data.buffer);
	var w = this.imgdata.width;
	// Fill dst with pixels from src
	for (let xy of this.comp) {
		var x = xy % w - x0;
		var y = ~~(xy / w) - y0;
		var dxy = y * sw + x;
		dst[dxy] = src[xy];
	}
	ctx.putImageData (seg,0,0);
	canvas.x0 = x0;
	canvas.y0 = y0;
	return canvas;
} 

// Merges the info of component other into this one
Segment.prototype.merge = function (other) {
	console.assert (this.imgdata == other.imgdata);
	var x0 = Math.min(this.x,other.x);
	var y0 = Math.min(this.y,other.y);
	var x1 = Math.max(this.x+this.width,other.x+other.width);
	var y1 = Math.max(this.y+this.height,other.y+other.height);
	this.x = x0;
	this.y = y0;
	this.width = x1-x0;
	this.height = y1-y0;
	var n1 = this.comp.length;
	var n2 = other.comp.length;
	for (var i = 0; i < 4; i++) {
		this.avgColor [i] = ~~((this.avgColor[i]*n1 + other.avgColor[i]*n2)/(n1+n2));
		this.minColor [i] = Math.min (this.minColor[i], other.minColor[i]);
		this.maxColor [i] = Math.min (this.maxColor[i], other.maxColor[i]);
	}
	var dst = this.comp;
	var src = other.comp;
	for (let c of src) {
		dst.push (c);
	}
	this.compCount += other.compCount;
}

// Returns an object map, such that map[segClass] is the number of
// 4-connected neighbors of the segment that have the given segment class
Segment.prototype.neighborCount = function () {

	var map = {};
	var w = this.imgdata.width;
	var h = this.imgdata.height;
	var neighbor = new Set();

	// Fill dst with pixels from src
	for (let xy of this.comp) {
		neighbor.add(xy);
		var x = xy % w;
		var y = ~~(xy / w);
		if (x > 0) neighbor.add(xy-1);
		if (x < w-1) neighbor.add(xy+1);
		if (xy >= w) neighbor.add(xy-w);
		if (y < h-1) neighbor.add(xy+w);
	}
	var data = this.imgdata.data;
	for (let xy of neighbor) {
		var i = xy*4;
		var c = this.pClass (data[i],data[i+1],data[i+2],data[i+3]);
		if (c in map) map[c]++;
		else map[c]=1;
	}
	return map;
}

// Segments an ImageData object imgdata. Function pclass classifies
// a pixel into a segment class -- its argument list are the color 
// components r,g,b,a and it should
// return an integer or some other value that can be tested for equality
// with other segment classes. 
//
// If specified, diff should be a predicate that tells whether two colors
// belong to different classes. If not specified, diff (r1,g1,b1,a1,r2,g2,b2,a2)
// is set to pclass(r1,g1,b1,a1)!=pclass(r2,g2,b2,a2).
//
// The function returns an array of Segments.
var segmenter = function (imgdata, pclass, diff) {

	var width = imgdata.width, height = imgdata.height, data = imgdata.data;

	var rg = new RasterGraph (width, height);

	diff = diff || function (r1,g1,b1,a1,r2,g2,b2,a2) { return pclass(r1,g1,b1,a1) != pclass(r2,g2,b2,a2); }

	for (var px = 0; px+1 < width; px++) {
		for (var py = 0; py+1 < height; py++) {
			var i = (py*width+px)*4;
			var j = i+width*4;
			if (diff (data[i],data[i+1],data[i+2],data[i+3],data[j],data[j+1],data[j+2],data[j+3])) {
				rg.cutSouthEdge (px,py);
			}
			j = i+4;
			if (diff (data[i],data[i+1],data[i+2],data[i+3],data[j],data[j+1],data[j+2],data[j+3])) {
				rg.cutEastEdge (px,py);
			}
		}
	}

	var py = height-1;
	for (var px = 0; px+1 < width; px++) {
		var i = (py*width+px)*4;
		var j = i+4;
		if (diff (data[i],data[i+1],data[i+2],data[i+3],data[j],data[j+1],data[j+2],data[j+3])) {
			rg.cutEastEdge (px,py);
		}
	}

	var px = width-1;
	for (var py = 0; py+1 < height; py++) {
		var i = (py*width+px)*4;
		var j = i+width*4;
		if (diff (data[i],data[i+1],data[i+2],data[i+3],data[j],data[j+1],data[j+2],data[j+3])) {
			rg.cutSouthEdge (px,py);
		}
	}

	var result = [];
	for (let comp of rg.connectedComponents()) {
		result.push (new Segment (comp, imgdata, pclass));
	}
	return result;
}
