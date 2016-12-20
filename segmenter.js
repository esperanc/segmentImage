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
	// Each connected component is a list of addresses of m
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
	}

	// Given an ImageData object with same dimensions as this graph,
	// returns an array of ImageData objects, each with a connected 
	// component of the original image. Each ImageData result is also
	// augmented with fields x0 and y0 which contain the offset of the 
	// upper left corner of the result w.r.t. original.
	self.segmentedImages = function (imgdata) {
		
		var width = imgdata.width, height = imgdata.height;
		console.assert (width == w && height == h);
		var src = new Uint32Array (imgdata.data.buffer);

		function segmentComponent (comp) {
			// find bounding box
			var x0 = comp[0] % w, x1 = x0;
			var y0 = ~~(comp[1] / w), y1 = y0;
			for (let xy of comp) {
				var x = xy % w;
				var y = ~~(xy / w);
				if (x < x0) x0=x;
				if (x > x1) x1=x;
				if (y < y0) y0=y;
				if (y > y1) y1=y;
			}
			// Create new ImageData
			var sw = x1-x0+1, sh = y1-y0+1, ns = sh*sh;
			var canvas = document.createElement('canvas');
			canvas.setAttribute ('width', sw);
			canvas.setAttribute ('height', sh);
			var ctx = canvas.getContext('2d');
			var seg = ctx.getImageData(0,0,sw,sh);
			var dst = new Uint32Array (seg.data.buffer);
			// Fill dst with pixels from src
			for (let xy of comp) {
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

		var result = [];
		for (let comp of self.connectedComponents()) {
			result.push (segmentComponent(comp));
		}
		return result;
	}

	return self;
};

// Segments an ImageData object imgdata. Function pclass classifies
// a pixel into a segment class -- its argument list are the color 
// components r,g,b,a and it should
// return an integer or some other value that can be tested for equality
// with other segment classes. The function returns a RasterGraph object
// where edges between pixels with different classes have been cut
var segmenter = function (imgdata, pclass) {

	var width = imgdata.width, height = imgdata.height, data = imgdata.data;

	var rg = new RasterGraph (width, height);
	for (var px = 0; px+1 < width; px++) {
		for (var py = 0; py+1 < height; py++) {
			var i = (py*width+px)*4;
			var class1 = pclass (data[i],data[i+1],data[i+2],data[i+3]);
			var j = i+width*4;
			var class2 = pclass (data[j],data[j+1],data[j+2],data[j+3]);
			if (class1 != class2) rg.cutSouthEdge (px,py);
			j = i+4;
			class2 = pclass (data[j],data[j+1],data[j+2],data[j+3]);
			if (class1 != class2) rg.cutEastEdge (px,py);
		}
	}

	var py = height-1;
	for (var px = 0; px < width; px++) {
		var i = (py*width+px)*4;
		var class1 = pclass (data[i],data[i+1],data[i+2],data[i+3]);
		var j = i+4;
		var class2 = pclass (data[j],data[j+1],data[j+2],data[j+3]);
		if (class1 != class2) rg.cutEastEdge (px,py);
	}

	var px = width-1;
	for (var py = 0; py+1 < height; py++) {
		var i = (py*width+px)*4;
		var class1 = pclass (data[i],data[i+1],data[i+2],data[i+3]);
		var j = i+width*4;
		var class2 = pclass (data[j],data[j+1],data[j+2],data[j+3]);
		if (class1 != class2) rg.cutSouthEdge (px,py);
	}

	return rg;
}
