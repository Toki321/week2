pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/switcher.circom";



template TreeLayer(n) {
  var nItems = 1 << n;
  signal input ins[nItems * 2];
  signal output outs[nItems];

  component hash[nItems];
  for(var i = 0; i < nItems; i++) {
    hash[i] = Poseidon(2);
    hash[i].inputs[0] <== ins[i * 2];
    hash[i].inputs[1] <== ins[i * 2 + 1];
    hash[i].out ==> outs[i];
  }
}

// Builds a merkle tree from leaf array
template CheckRoot(n) {
  signal input leaves[2**n];
  signal output root;

  component layers[n];
  for(var level = n - 1; level >= 0; level--) {
    layers[level] = TreeLayer(level);
    for(var i = 0; i < (1 << (level + 1)); i++) {
      layers[level].ins[i] <== level == n - 1 ? leaves[i] : layers[level + 1].outs[i];
    }
  }

  root <== n > 0 ? layers[0].outs[0] : leaves[0];
}

template MerkleTreeInclusionProof(n) {
    signal input leaf;
    signal input path_elements[n];
    signal input path_index[n]; // path index are 0's and 1's indicating whether the current element is on the left or right
    signal output root; // note that this is an OUTPUT signal

    //[assignment] insert your code here to compute the root from a leaf and elements along the path
    component switcher[n];
    component hasher[n];
    component indexBits[n];

    for (var i = 0; i < n; i++) {
        switcher[i] = Switcher();
        indexBits[i] = Num2Bits(n);
        indexBits[i].in <== path_index[i];
        switcher[i].L <== i == 0 ? leaf : hasher[i - 1].out;
        switcher[i].R <== path_elements[i];
        switcher[i].sel <== indexBits[i].out[i];

        hasher[i] = Poseidon(2);
        hasher[i].inputs[0] <== switcher[i].outL;
        hasher[i].inputs[1] <== switcher[i].outR;
    }

    root <== hasher[n - 1].out;
}

// component main = MerkleTreeInclusionProof(3);

/* INPUT = {
    "leaf": "1",
    "path_elements":["2",14744269619966411208579211824598458697587494354926760081771325075741142829156,
    7423237065226347324353380772367382631490014989348495481811164164159255474657],
    "path_index" :[0,0,0]
    
} */