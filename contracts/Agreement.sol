// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Agreement
/// @notice A single EscrowFlow agreement. Deployed as a minimal proxy clone by
///         EscrowFlowFactory. Depending on `agreementType`, it behaves either
///         as a Group Splitter (shared expense pot) or a Service Escrow
///         (locked funds released manually or claimable after a deadline).
contract Agreement {
    enum AgreementType {
        Group,
        Escrow
    }

    // ---------------------------------------------------------------------
    // Shared state
    // ---------------------------------------------------------------------

    AgreementType public agreementType;
    string public title;
    address public creator;
    uint256 public deadline; // unix timestamp
    uint256 public createdAt;
    bool public initialized;

    // ---------------------------------------------------------------------
    // Group Splitter state
    // ---------------------------------------------------------------------

    address[] public participants;
    mapping(address => bool) public isParticipant;

    struct Expense {
        address payer;
        uint256 amount;
        string description;
        uint256 timestamp;
    }

    Expense[] public expenses;

    /// @dev Positive balance = this address is owed money.
    ///      Negative balance = this address owes money.
    mapping(address => int256) public balances;

    // ---------------------------------------------------------------------
    // Service Escrow state
    // ---------------------------------------------------------------------

    address public payer;
    address public provider;
    uint256 public lockedAmount;
    bool public released;
    string public escrowDescription;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ExpenseAdded(address indexed payer, uint256 amount, string description, uint256 timestamp);
    event Settled(address indexed from, address indexed to, uint256 amount);
    event FundsLocked(address indexed payer, uint256 amount, string description);
    event FundsReleased(address indexed to, uint256 amount, bool autoReleased);

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyParticipant() {
        require(isParticipant[msg.sender], "Not a participant");
        _;
    }

    modifier onlyGroup() {
        require(agreementType == AgreementType.Group, "Not a group agreement");
        _;
    }

    modifier onlyEscrow() {
        require(agreementType == AgreementType.Escrow, "Not an escrow agreement");
        _;
    }

    // ---------------------------------------------------------------------
    // Initialization (called once by the factory right after cloning)
    // ---------------------------------------------------------------------

    function initialize(
        AgreementType _type,
        string memory _title,
        address _creator,
        uint256 _deadline,
        address[] memory _participants,
        address _provider
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;

        agreementType = _type;
        title = _title;
        creator = _creator;
        deadline = _deadline;
        createdAt = block.timestamp;

        if (_type == AgreementType.Group) {
            for (uint256 i = 0; i < _participants.length; i++) {
                address p = _participants[i];
                if (p != address(0) && !isParticipant[p]) {
                    isParticipant[p] = true;
                    participants.push(p);
                }
            }
            if (!isParticipant[_creator]) {
                isParticipant[_creator] = true;
                participants.push(_creator);
            }
        } else {
            require(_provider != address(0), "Provider required");
            payer = _creator;
            provider = _provider;
        }
    }

    // ---------------------------------------------------------------------
    // Group Splitter functions
    // ---------------------------------------------------------------------

    /// @notice Record an expense paid by msg.sender and split it equally
    ///         among all participants.
    function addExpense(uint256 amount, string calldata description) external onlyGroup onlyParticipant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(description).length > 0, "Description required");

        uint256 numParticipants = participants.length;
        uint256 share = amount / numParticipants;

        for (uint256 i = 0; i < numParticipants; i++) {
            address p = participants[i];
            if (p == msg.sender) {
                balances[p] += int256(amount) - int256(share);
            } else {
                balances[p] -= int256(share);
            }
        }

        expenses.push(Expense(msg.sender, amount, description, block.timestamp));
        emit ExpenseAdded(msg.sender, amount, description, block.timestamp);
    }

    /// @notice Settle up with another participant by sending them native
    ///         token. Reduces msg.sender's debt and the recipient's credit.
    function settle(address to) external payable onlyGroup onlyParticipant {
        require(isParticipant[to], "Recipient not a participant");
        require(msg.value > 0, "Must send value");
        require(balances[msg.sender] < 0, "You don't owe anything");

        int256 owed = -balances[msg.sender];
        require(int256(msg.value) <= owed, "Amount exceeds what you owe");

        balances[msg.sender] += int256(msg.value);
        balances[to] -= int256(msg.value);

        (bool sent, ) = to.call{value: msg.value}("");
        require(sent, "Transfer failed");

        emit Settled(msg.sender, to, msg.value);
    }

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    function getExpenses() external view returns (Expense[] memory) {
        return expenses;
    }

    function getExpensesCount() external view returns (uint256) {
        return expenses.length;
    }

    function getBalance(address user) external view returns (int256) {
        return balances[user];
    }

    // ---------------------------------------------------------------------
    // Service Escrow functions
    // ---------------------------------------------------------------------

    /// @notice Payer locks native token into the escrow.
    function lockFunds(string calldata description) external payable onlyEscrow {
        require(msg.sender == payer, "Only payer can lock funds");
        require(msg.value > 0, "Must send value");
        require(!released, "Already released");

        lockedAmount += msg.value;
        if (bytes(description).length > 0) {
            escrowDescription = description;
        }

        emit FundsLocked(msg.sender, msg.value, description);
    }

    /// @notice Payer manually releases locked funds to the provider at any
    ///         time (e.g. once satisfied with delivered work).
    function release() external onlyEscrow {
        require(msg.sender == payer, "Only payer can release manually");
        _release(false);
    }

    /// @notice Provider claims locked funds once the deadline has passed,
    ///         protecting them if the payer goes silent.
    function claim() external onlyEscrow {
        require(msg.sender == provider, "Only provider can claim");
        require(block.timestamp >= deadline, "Deadline not reached yet");
        _release(true);
    }

    function _release(bool autoReleased) internal {
        require(!released, "Already released");
        require(lockedAmount > 0, "No funds locked");

        released = true;
        uint256 amount = lockedAmount;
        lockedAmount = 0;

        (bool sent, ) = provider.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsReleased(provider, amount, autoReleased);
    }

    function isClaimable() external view returns (bool) {
        return agreementType == AgreementType.Escrow && !released && block.timestamp >= deadline && lockedAmount > 0;
    }

    // ---------------------------------------------------------------------
    receive() external payable {
        revert("Use lockFunds()");
    }
}
