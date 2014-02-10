EAT = {};

// make a GET request
EAT.get = function(url, responseType) {
	return EAT.request({
		url: url,
		method: 'GET',
		responseType: responseType
	})
};

// make an XMLHttpRequest
EAT.request = function(settings) {
	var params = {
		method: 'GET',
		responseType: ''
	};

	for (var key in settings) {
		params[key] = settings[key];
	};

	return new Promise(function(resolve, reject) {
		var xhr = new XMLHttpRequest;

		xhr.onload = function() {
			resolve(xhr.response, xhr.statusText, xhr);
		};

		xhr.onerror = function() {
			reject(xhr, xhr.statusText);
		};

		xhr.open(params.method, params.url);
		xhr.responseType = params.responseType;
		xhr.send();
	});
};

// load a script
EAT.require = function(url) {
	if (EAT.typeof(url) == 'array') {
		return Promise.all(url.map(EAT.require));
	}

	return new Promise(function(resolve, reject) {
		var script = document.createElement('script');
		script.src = url;
		script.onload = resolve;
		script.onerror = reject;
		document.body.appendChild(script);
	});
};

// determine the type of an object
EAT.typeof = function(object) {
	switch (Object.prototype.toString.call(object)) {
		case '[object Object]':
			return 'object';

		case '[object Array]':
			return 'array';

		case '[object String]':
			return 'string';
		
		case '[object Function]':
			return 'function';
	}
};

// extract content from an HTML document
// https://github.com/hubgit/extract
(function() {
	var parse = function(template, root) {
		switch (EAT.typeof(template)) {
			case 'array':
				return parseArray(template, root);

			case 'object':
				return parseObject(template, root);
				
			case 'function':
				return parseFunction(template, root);

			default:
				return parseItem(template, root);
		}
	};

	var parseArray = function(template, root) {
		// if the first item is null, use the current root and run all templates
		if (template[0] == null) {
			return template.slice(1).map(function(item) {
				return parse(item, root);
			});
		}

		var nodes = root.querySelectorAll(template[0]);

		return Array.prototype.map.call(nodes, function(root) {
			return parse(template[1], root);
		});
	};

	var parseObject = function(template, root) {
		var output = {};

		for (var key in template) {
			if (template.hasOwnProperty(key)) {
				output[key] = parse(template[key], root);
			}
		}

		return output;
	};
	
	var parseFunction = function(template, root) {
		return template(root);
	};

	var parseItem = function(template, root) {
		if (template == '.') {
			return root.textContent;
		}
		
		// TODO: handle attribute at the end of a longer selector
		if (template.substring(0, 1) == '@') {
			return root.getAttribute(template.substring(1));
		}

		// TODO: traversing, e.g. parents
		var node = root.querySelector(template);

		return node ? node.textContent : null;
	};

	EAT.extract = parse;
})();

// XMLHttpRequest queue
// https://github.com/hubgit/jquery-ajax-queue
(function() {
	EAT.queue = function(params, options) {
		var item = new QueueItem(params);

		for (var key in options) {
			params[key] = options[key];
		};

		if (item.priority) {
			queue.items.unshift(item);
		} else {
			queue.items.push(item);
		}

		queue.next();

		return new Promise(function(resolve, reject) {
			item.deferred.resolve = resolve;
			item.deferred.reject = reject;
		});
	};

	EAT.queue.concurrent = function(concurrent) {
		queue.concurrent = concurrent;
	};

	var QueueItem = function(params) {
		this.params = params;
		this.tries = 1;
		this.priority = false;
		this.limit = 0;
		this.delay = { rate: 10000, server: 5000 };
		this.deferred = {};
	};

	QueueItem.prototype.run = function() {
		var item = this;

		var request = EAT.request(item.params);

		//item.deferred.notify(request, 'start', item);

		request.then(function(response, statusText, request) {
			queue.currentCount--;

			item.deferred.resolve(response, statusText, request);

			window.setTimeout(function() {
				queue.next();
			}, item.limit);
		});

		request.catch(function(request, statusText) {
			queue.currentCount--;

			switch (request.status) {
				case 403: // rate-limited
					queue.stop(item.delay.rate);
					queue.items.unshift(item); // add this item back to the queue
					//item.deferred.notify(request, 'rate-limit', item);
					break;

				case 500: // server error
				case 503: // unknown error
					queue.stop(item.delay.server);

					if (--item.tries) {
						queue.items.unshift(item); // add this item back to the queue
						//item.deferred.notify(request, 'retry', item);
					} else {
						item.deferred.reject(request, statusText);
					}
					break;

				default:
					item.deferred.reject(request, statusText);
					queue.next();
					break;
			}
		});
	};

	var queue = {
		items: [],
		concurrent: 1,
		currentCount: 0,
		stopped: false,

		stop: function(delay) {
			this.stopped = true;

			if (delay) {
				window.setTimeout(function() {
					queue.start();
				}, delay);
			}
		},

		start: function()  {
			this.stopped = false;
			this.next();
		},

		clear: function(){
			this.items = [];
			this.currentCount = 0;
		},

		next: function() {
			if (this.stopped) {
				return;
			}

			while (this.items.length && this.currentCount < this.concurrent) {
				this.currentCount++;
				this.items.shift().run();
			}
		}
	};
})();
