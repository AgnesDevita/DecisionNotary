// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ContextSnapshot {
    string public topic;
    address public owner;

    struct Commit {
        address author;
        string data;
        uint256 timestamp;
    }

    struct Outcome {
        string result;
        uint256 resolvedAt;
    }

    Commit[] public commits;
    Outcome public outcome;
    bool public resolved;

    event Committed(address indexed author, uint256 indexed decisionId, string data, uint256 timestamp);
    event OutcomeResolved(string result);

    modifier onlyAdmin() {
        require(msg.sender == owner, "Not admin");
        _;
    }

    constructor(string memory _topic, address _admin) {
        topic = _topic;
        owner = _admin;
    }

    function commit(string calldata data) external onlyAdmin returns (uint256 decisionId) {
        decisionId = commits.length;
        commits.push(Commit({
            author: msg.sender,
            data: data,
            timestamp: block.timestamp
        }));
        emit Committed(msg.sender, decisionId, data, block.timestamp);
    }

    function resolveOutcome(string calldata result) external onlyAdmin {
        require(!resolved, "Already resolved");
        outcome = Outcome({
            result: result,
            resolvedAt: block.timestamp
        });
        resolved = true;
        emit OutcomeResolved(result);
    }

    function getOutcome() external view returns (Outcome memory) {
        require(resolved, "Not yet resolved");
        return outcome;
    }

    function getCommits() external view returns (Commit[] memory) {
        return commits;
    }
}
