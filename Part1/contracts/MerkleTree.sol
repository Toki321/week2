//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { PoseidonT3 } from "./Poseidon.sol"; //an existing library to perform Poseidon hash on solidity
import "./verifier.sol"; //inherits with the MerkleTreeInclusionProof verifier contract

contract MerkleTree is Verifier {
    uint256[] public hashes; // the Merkle tree in flattened array form
    uint256 public index = 0; // the current index of the first unfilled leaf
    uint256 public root; // the current Merkle root

    error NoMoreEmptyLeaves();

    constructor() {
        // [assignment] initialize a Merkle tree of 8 with blank leaves
        hashes = new uint256[](15); // 15 
        for (uint i=0; i<8; ++i) {
            hashes[i] = 0;
        }

        // PoseidonT3.poseidon([], hashes[]])
        for (uint i=0; i<3; ++i) {
            if (i == 0) {
                for (uint j=0; j<4; j++) {
                    hashes[j+8] = PoseidonT3.poseidon([hashes[j*2], hashes[j*2+1]]);
                }
            }
            else if (i == 1) {
                    hashes[12] = PoseidonT3.poseidon([hashes[8], hashes[9]]);
                    hashes[13] = PoseidonT3.poseidon([hashes[10], hashes[11]]);
            }
            else if (i == 2) {
                    hashes[14] = PoseidonT3.poseidon([hashes[12], hashes[13]]);
            }
        }
        root = hashes[14];
    }


    function insertLeaf(uint256 hashedLeaf) public returns (uint256) {
        // [assignment] insert a hashed leaf into the Merkle tree

        // means all leaves have already a value inserted
        if (index == 8) {
            revert NoMoreEmptyLeaves();
        }

        hashes[index] = hashedLeaf;

            for (uint i=0; i<3; ++i) {
                if (i == 0) {
                    for (uint j=0; j<4; j++) {
                        hashes[j+8] = PoseidonT3.poseidon([hashes[j*2], hashes[j*2+1]]);
                    }
                }
                else if (i == 1) {
                        hashes[12] = PoseidonT3.poseidon([hashes[8], hashes[9]]);
                        hashes[13] = PoseidonT3.poseidon([hashes[10], hashes[11]]);
                }
                else if (i == 2) {
                        hashes[14] = PoseidonT3.poseidon([hashes[12], hashes[13]]);
                }
        }
            index = index + 1;
            root = hashes[14];
            return root;
    }
        

    function verify(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[1] memory input
        ) public view returns (bool) {

        // [assignment] verify an inclusion proof and check that the proof root matches current root
        
        return input[0] == root && Verifier.verifyProof(a, b, c, input);
    }
}
