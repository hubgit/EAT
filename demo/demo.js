var readCitations = function(result) {
	var titles = EAT.extract(['#references .citation', {
		title: '.article-title'
	}], result).filter(function(item) {
		return item.title;
	}).map(function(item) {
		return item.title.trim();
	});

	var output = document.createElement('output');
	output.style.whiteSpace = 'pre-wrap'
	output.textContent = titles.join("\n");
	document.body.appendChild(output);
};

Promise.all([
	EAT.get('https://peerj.com/articles/258.html', 'document'),
	EAT.queue({
		url: 'https://peerj.com/articles/182.html',
		responseType: 'document'
	})
]).then(function(result) {
	result.forEach(readCitations);
});