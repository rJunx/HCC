"use strict";

//Homomorphic Cloud Calculate Engine

var HCCEngine = HCCEngine || {};

HCCEngine.KeyBits = 512;
HCCEngine.isCacheKey = false;

HCCEngine.showErrorMessage = function(e) {
	function buildErrorMessage(e) {
		return e.location !== undefined ? "Line " + e.location.start.line + ", column " + e.location.start.column + ": " + e.message : e.message;
	}

	$("#parse-message").attr("class", "message error").text(buildErrorMessage(e));
}

HCCEngine.showResult = function(value) {
	$("#output").removeClass("disabled").text(
		value
	);
}

HCCEngine.showProgress = function() {
	$("#progress").text('Progress: ' + HCCEngine.taskMan.finishCount + '/' + HCCEngine.taskMan.totalTask);
};


HCCEngine.addDetailOutput = function(str) {
	var v = $("#detail").val();
	if (v === "") {
		$("#detail").text(str);
	} else {
		$("#detail").text(v + "\n" + str);
	}
}

HCCEngine.addKeyDetailOutput = function(str) {
	var v = $("#key-detail").val();
	if (v === "") {
		$("#key-detail").text(str);
	} else {
		$("#key-detail").text(v + "\n" + str);
	}
}


HCCEngine.showTimeConsumption = function() {
	var time = (new Date).getTime() - HCCEngine.startTime;

	var format = function(name, v, percent) {
		return name + v + "(" + percent.toFixed(2) +"%)\n";
	}

	var str = "";
	str += format("Generate Key Time : ", HCCEngine.genKeyTime, HCCEngine.genKeyTime / time *100);
	str += format("Encrypt Time : ", HCCEngine.encryptTime, HCCEngine.encryptTime / time *100);
	str += format("Decrypt Time : ", HCCEngine.decryptTime, HCCEngine.decryptTime / time *100);
	str += format("Network Time : ", HCCEngine.networkTime, HCCEngine.networkTime / time *100);
	
	str += "Total Time: " + time + "\n";
	str += "Total Task : " + HCCEngine.taskMan.totalTask + "\n";

	$("#timeConsumption").text(str);
}

HCCEngine.doEquation = function(equation) {
	var KB = 1024;
	var MS_IN_S = 1000;

	var travel = function(node, handler) {
		var children = node.children,
			l = 0;
		if (children && (l = children.length) > 0) {
			for (var i = 0; i < l; i++) {
				travel(children[i], handler);
			}
		}

		handler(node);
	}

	var buildSizeAndTimeInfoHtml = function(title, size, time) {
		return $("<span/>", {
			"class": "size-and-time",
			title: title,
			html: " [" + (size / KB).toPrecision(2) + "&nbsp;kB, " + time + "&nbsp;ms, " + ((size / KB) / (time / MS_IN_S)).toPrecision(2) + "&nbsp;kB/s]"
		});
	}

	$("#output").addClass("disabled").text("Output not available.");
	$("#parse-message").attr("class", "message disabled").text("Parser not available.");

	try {
		$("#parse-message").attr("class", "message progress").text("Parsing the input...");
		var timeBefore = (new Date).getTime();
		var eTree = HCCEngine.parser.parse(equation);
		var timeAfter = (new Date).getTime();

		$("#parse-message")
			.attr("class", "message info")
			.text("Input parsed successfully.")
			.append(buildSizeAndTimeInfoHtml(
				"Parsing time and speed",
				$("#input").val().length,
				timeAfter - timeBefore
			));

		$("#key-detail").text('');
		$("#detail").text('');
		HCCEngine.reset();
		HCCEngine.startTime = (new Date).getTime();
		travel(eTree, HCCEngine.addTask);

		var key = HCCEngine.cachePaillierKey;
		HCCEngine.addKeyDetailOutput("Paillier: ");
		HCCEngine.addKeyDetailOutput("Public key: (" + key.n.toString(10) + ", " + key.g.toString(10) +")");
		HCCEngine.addKeyDetailOutput("Private key: (" + key.lambda.toString(10) + key.u.toString(10) + ")");

		HCCEngine.addKeyDetailOutput("");

		var key = HCCEngine.cacheRSAKey;
		HCCEngine.addKeyDetailOutput("RSA: ");
		HCCEngine.addKeyDetailOutput("Public key: (" + key.n.toString(10) + ", " + key.e.toString(10) +")");
		HCCEngine.addKeyDetailOutput("Private key: (" + key.d.toString(10) +")");

		HCCEngine.taskMan.run();
	} catch (e) {
		HCCEngine.showErrorMessage(e);
	}
}

HCCEngine.getPaillierKey = function(alwaysNew) {
	var key = null;

	if (alwaysNew) {
		key = new PaillierKey();
		key.generate(HCCEngine.KeyBits);
	} else {
		if (HCCEngine.cachePaillierKey) {
			key = HCCEngine.cachePaillierKey;
		} else {
			key = new PaillierKey();
			key.generate(HCCEngine.KeyBits);
			HCCEngine.cachePaillierKey = key;
		}
	}
	return key;
}

HCCEngine.getRSAKey = function(alwaysNew) {
	var key = null;

	if (alwaysNew) {
		key = new RSAKey();
		key.generate(HCCEngine.KeyBits, "03");
	} else {
		if (HCCEngine.cacheRSAKey) {
			key = HCCEngine.cacheRSAKey;
		} else {
			key = new RSAKey();
			key.generate(HCCEngine.KeyBits, "03");
			HCCEngine.cacheRSAKey = key;
		}
	}
	return key;
}

HCCEngine.addTask = function(node) {
	if (node.hasOwnProperty('value'))
		return;

	var t = HCCEngine.genCCTask(node);
	HCCEngine.taskMan.addTask(t);
}

HCCEngine.genCCTask = function genCCTask(node) {
	var task;
	var st = (new Date).getTime();

	if (node.op === '+' || node.op === '-') {
		task = new CASTask();
		task.key = HCCEngine.getPaillierKey(false);
	} else if (node.op === '*') {
		task = new CMTask();
		task.key = HCCEngine.getRSAKey(false);
	}

	HCCEngine.genKeyTime += ((new Date).getTime() - st);

	task.tag = HCCEngine.taskMan.totalTask;
	task.node = node;
	return task;
}

var TaskMan = function() {
	this.list = [];
	this.finishCount = 0;
	this.totalTask = 0;
};

TaskMan.prototype.reset = function(task) {
	this.list = [];
	this.finishCount = 0;
	this.totalTask = 0;
}

TaskMan.prototype.addTask = function(task) {
	this.list.push(task);
	this.totalTask++;
}

TaskMan.prototype.run = function() {
	var l = this.list.length;
	HCCEngine.showProgress();

	if (this.finishCount == this.totalTask) {
		HCCEngine.showResult(this.list[l - 1].node.value);
		HCCEngine.showTimeConsumption();
		return;
	}

	for (var i = 0; i < l; i++) {
		if (!this.list[i].isFinish) {
			HCCEngine.addDetailOutput("Step " + (i + 1) + ":");
			this.list[i].run();
			return;
		}
	}
}

TaskMan.prototype.onFinishTask = function(data) {
	for (var i = 0; i < this.list.length; i++) {
		if (this.list[i].tag == parseInt(data.tag)) {
			this.list[i].isFinish = true;
			this.list[i].onFinish(data);
			this.finishCount++;
			break;
		}
	}
	this.run();
}

var CCTask = function() {
	this.tag = null;
	this.isFinish = false;
	this.key = null;
	this.node = null;
}

CCTask.prototype.run = function() {
	var data = {
			tag: this.tag,
			tuple: []
		};

	var st = (new Date).getTime();
	this.doTask(data);
	HCCEngine.encryptTime += ((new Date).getTime() - st);

	this.startTime = (new Date).getTime();
	$.ajax('/', {
		type: 'POST',
		data: data,
		success: HCCEngine.receiveCalRet
	});
}

CCTask.prototype.onFinish = function(data) {
	HCCEngine.networkTime += ((new Date).getTime() - this.startTime);

	var a = new BigInteger(data.total, 10);

	var st = (new Date).getTime();
	var v = this.key.doPrivate(a);
	HCCEngine.decryptTime += ((new Date).getTime() - st);

	HCCEngine.addDetailOutput("   Receive: " + data.total);

	if (this instanceof CASTask) {
		HCCEngine.addDetailOutput("   Paillier Decrypt: ");
		HCCEngine.addDetailOutput("      D(" + data.total + ") = " + v);
	} else if (this instanceof CMTask) {
		HCCEngine.addDetailOutput("   RSA Decrypt: ");
		HCCEngine.addDetailOutput("      D(" + data.total + ") = " + v);
	}

	this.finishTask(v);
}

var CASTask = function() {};
CASTask.prototype = new CCTask();
CASTask.prototype.doTask = function(data) {
	var children = this.node.children,
		l = children.length,
		tuple = data.tuple;

	var num = new BigInteger(children[0].value, 10);
	tuple.push(this.key.doPublic(num).toString(10));
	
	var rhs = ((this.node.op==='-')? '-':'')+children[1].value;
	num = new BigInteger(rhs, 10);
	tuple.push(this.key.doPublic(num).toString(10));

	HCCEngine.addDetailOutput("   Expression: " + children[0].value + " " + this.node.op + " " + children[1].value);

	HCCEngine.addDetailOutput("   Send Paillier encrypt: ");
	HCCEngine.addDetailOutput("      E(" + children[0].value + ") = " + tuple[0]);
	HCCEngine.addDetailOutput("      E(" + rhs + ") = " + tuple[1]);
}

CASTask.prototype.finishTask = function(value) {
	var threshold = this.key.n.divide(new BigInteger("2", 10));
	if (value.compareTo(threshold) > 0) {
		this.node.value = value.subtract(this.key.n).toString(10);
		this.node.isPositive = false;

		HCCEngine.addDetailOutput("   Result: " + value + ' - ' + this.key.n.toString(10) + " = " + this.node.value);
	} else {
		this.node.value = value.toString(10);
		this.node.isPositive = true;

		HCCEngine.addDetailOutput("   Result: " + this.node.value);
	}

	HCCEngine.addDetailOutput("");
}

var CMTask = function() {};
CMTask.prototype = new CCTask();
CMTask.prototype.doTask = function(data) {
	var children = this.node.children,
	l = children.length,
	tuple = data.tuple,
	hasN = false;

	var expression = '';
	var encrypt = ""

	for (var i = 0; i < l; i++) {
		var v = children[i].value;
		var num = new BigInteger(v, 10);
		var ev;
		if (!children[i].isPositive) {
			ev = this.key.doPublic(num.mod(this.key.n)).toString(10);
			tuple.push(ev);
			hasN = !hasN;
			encrypt += ( "      E(" + v + ' Mod '+ this.key.n.toString(10) + ') = ' + ev );
		} else {
			ev = this.key.doPublic(num).toString(10);
			tuple.push(ev);
			encrypt += ( "      E(" + v + ') = ' + ev );
		}

		if (i > 0) {
			expression += ' * ';
		}

		if (i != (l - 1)) {
			encrypt += "\n";
		}

		expression += v;
	}

	HCCEngine.addDetailOutput("   Expression: " + expression);

	if (hasN) {
		data.n = this.key.n.toString(10);

		HCCEngine.addDetailOutput("   Send RSA encrypt: ");
		HCCEngine.addDetailOutput(encrypt);
	}
}

CMTask.prototype.finishTask = function(value) {
	// if (this.node.isPositive) {
	// 	this.node.value = v.toString(10);
	// } else {
	// 	this.node.value = value.subtract(this.key.n).toString(10);
	// }

	var threshold = this.key.n.divide(new BigInteger("2", 10));
	if (value.compareTo(threshold) > 0) {
		this.node.value = value.subtract(this.key.n).toString(10);
		this.node.isPositive = false;

		HCCEngine.addDetailOutput("   Result: " + value + ' - ' + this.key.n.toString(10) + " = " + this.node.value);
	} else {
		this.node.value = value.toString(10);
		this.node.isPositive = true;

		HCCEngine.addDetailOutput("   Result: " + this.node.value);
	}
}

HCCEngine.receiveCalRet = function(data) {
	HCCEngine.taskMan.onFinishTask(data);
}

HCCEngine.reset = function() {
	HCCEngine.taskMan.reset();
	HCCEngine.encryptTime = 0;
	HCCEngine.decryptTime = 0;
	HCCEngine.networkTime = 0;
	HCCEngine.startTime = 0;
	HCCEngine.genKeyTime = 0;

	if (!HCCEngine.isCacheKey) {
		HCCEngine.cachePaillierKey = null;
		HCCEngine.cacheRSAKey = null;
	} else {
		HCCEngine.getPaillierKey();
		HCCEngine.getRSAKey();
	}
};

HCCEngine.onBtnCalClick = function(e) {
	HCCEngine.reset();
	HCCEngine.doEquation($("#input").val());
};

HCCEngine.onCacheKeyClick = function(e) {
	HCCEngine.isCacheKey = $("#cacheKey").prop("checked");
};

HCCEngine.init = function() {
	HCCEngine.taskMan = new TaskMan();

	HCCEngine.KeyBits = parseInt($('#inputNumbits').val());
	$('#btnCal').on('click', HCCEngine.onBtnCalClick);
	$('#inputNumbits').on('input', function() {
		HCCEngine.KeyBits = parseInt($(this).val());
		HCCEngine.cachePaillierKey = null;
		HCCEngine.cacheRSAKey = null;
	});
	$('#cacheKey').on('click', HCCEngine.onCacheKeyClick);
}

$(document).ready(HCCEngine.init);