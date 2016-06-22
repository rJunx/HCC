PaillierKey = function() {
	this.p = null;
	this.q = null;
	this.n = null;
	this.n2 = null;

	this.lambda = null;
	this.u = null;
	this.bits = null;
}

PaillierKey.prototype.generate = function(modulusbits) {
	var p, q, n, rng = new SecureRandom();
	do {
		do {
			p = new BigInteger(modulusbits>>1, 1, rng);
		} while (!p.isProbablePrime(10));

		do {
			q = new BigInteger(modulusbits>>1, 1, rng);
		} while(!q.isProbablePrime(10));

		n = p.multiply(q);
	} while(!(n.testBit(modulusbits - 1)) || (p.compareTo(q) == 0));

	var lambda = p.subtract(BigInteger.ONE).lcm(q.subtract(BigInteger.ONE));
	var n2 = n.square();

	this.p = p;
	this.q = q;
	this.n = n;
	this.n2 = n2;
	this.lambda = lambda;
	this.bits = modulusbits;
	this.g = n.add(BigInteger.ONE);
	this.u = this.L(this.g.modPow(lambda, n2)).modInverse(n);
}

PaillierKey.prototype.getRN = function(a) {
	var r, rng = new SecureRandom();
	do {
		r = new BigInteger(this.bits,rng);
		// make sure r <= n
	} while(r.compareTo(this.n) >= 0);
	return r.modPow(this.n, this.n2);
}

PaillierKey.prototype.randomize = function(a) {
	var rn = this.getRN();
	return (a.multiply(rn)).mod(this.n2);
}

PaillierKey.prototype.doPublic = function(m) {
	return this.randomize(this.n.multiply(m).add(BigInteger.ONE).mod(this.n2));
}

PaillierKey.prototype.L = function(v) {
	return v.subtract(BigInteger.ONE).divide(this.n);
}

PaillierKey.prototype.doPrivate = function(c) {
	return this.L(c.modPow(this.lambda, this.n2)).multiply(this.u).mod(this.n);
}