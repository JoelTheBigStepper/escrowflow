// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Agreement
/// @notice A single PotLock agreement, deployed fresh per agreement by
///         PotLockFactory. Behaves either as a Group Pot (shared expenses
///         with a running ledger + batch settle) or a Service Escrow (funds
///         locked by a payer, released manually or claimable by the
///         recipient after a deadline).
contract Agreement {
    enum AgreementType {
        Group,
        Escrow
    }

    enum EscrowStatus {
        AwaitingDeposit,
        Locked,
        Released,
        Expired
    }

    // ---------------------------------------------------------------------
    // Shared state
    // ---------------------------------------------------------------------

    AgreementType public agreementType;
    string public title;
    string public description; // group pot description OR escrow service description
    address public creator;
    uint256 public deadline; // unix timestamp
    uint256 public createdAt;
    bool public initialized;

    // ---------------------------------------------------------------------
    // Group Pot state
    // ---------------------------------------------------------------------

    address[] public participants;
    mapping(address => bool) public isParticipant;

    struct Expense {
        address payer;
        uint256 amount;
        string description;
        address[] splitAmong;
        uint256 timestamp;
    }

    Expense[] private expenses;

    /// @dev Positive balance = this address is owed money (paid more than their share).
    ///      Negative balance = this address owes money (owes more than they paid).
    mapping(address => int256) public balances;

    // ---------------------------------------------------------------------
    // Service Escrow state
    // ---------------------------------------------------------------------

    address public payer;
    address public recipient;
    uint256 public targetAmount; // amount the payer intends to lock, set at creation
    uint256 public lockedAmount;
    bool public released;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ParticipantAdded(address indexed participant);
    event ParticipantRemoved(address indexed participant);
    event ExpenseAdded(
        uint256 indexed expenseId,
        address indexed payer,
        uint256 amount,
        string description,
        address[] splitAmong,
        uint256 timestamp
    );
    event Settled(address indexed from, uint256 amountDistributed, uint256 refunded);
    event Withdrawn(address indexed who, uint256 amount);
    event FundsLocked(address indexed payer, uint256 amount);
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
    // Initialization (called once by the factory right after deployment)
    // ---------------------------------------------------------------------

    function initialize(
        AgreementType _type,
        string memory _title,
        string memory _description,
        address _creator,
        uint256 _deadline,
        address[] memory _participants,
        address _recipient,
        uint256 _targetAmount
    ) external payable {
        require(!initialized, "Already initialized");
        initialized = true;

        agreementType = _type;
        title = _title;
        description = _description;
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

            if (msg.value > 0) {
                _recordExpense(_creator, msg.value, "Initial deposit", participants);
            }
        } else {
            require(_recipient != address(0), "Recipient required");
            payer = _creator;
            recipient = _recipient;
            targetAmount = _targetAmount;

            if (msg.value > 0) {
                lockedAmount += msg.value;
                emit FundsLocked(_creator, msg.value);
            }
        }
    }

    // ---------------------------------------------------------------------
    // Group Pot functions
    // ---------------------------------------------------------------------

    /// @notice Add a new participant to the pot. Any existing participant can invite others.
    function addParticipant(address who) external onlyGroup onlyParticipant {
        require(who != address(0), "Invalid address");
        require(!isParticipant[who], "Already a participant");
        isParticipant[who] = true;
        participants.push(who);
        emit ParticipantAdded(who);
    }

    /// @notice Remove a participant. Only allowed while their ledger balance
    ///         is exactly zero, so removing them can never orphan a debt or
    ///         credit. Cannot remove yourself (leave the pot by settling up
    ///         first, then asking another participant to remove you).
    function removeParticipant(address who) external onlyGroup onlyParticipant {
        require(who != msg.sender, "Cannot remove yourself");
        require(isParticipant[who], "Not a participant");
        require(balances[who] == 0, "Participant has an outstanding balance, settle up first");

        isParticipant[who] = false;
        uint256 n = participants.length;
        for (uint256 i = 0; i < n; i++) {
            if (participants[i] == who) {
                participants[i] = participants[n - 1];
                participants.pop();
                break;
            }
        }
        emit ParticipantRemoved(who);
    }

    /// @notice Withdraw MON that's actually sitting in this contract (e.g.
    ///         from an "Initial deposit" made at pot creation) against your
    ///         positive ledger balance. Everyday settle-up payments go
    ///         directly peer-to-peer via settleAll() and never touch the
    ///         contract's own balance — this only covers the deposit case.
    function withdrawExcess() external onlyGroup onlyParticipant {
        require(balances[msg.sender] > 0, "No credit to withdraw");
        uint256 held = address(this).balance;
        require(held > 0, "This pot isn't holding any funds");

        uint256 credit = uint256(balances[msg.sender]);
        uint256 amount = credit > held ? held : credit;

        balances[msg.sender] -= int256(amount);
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Record an expense. `payerAddr` is who actually paid (defaults to
    ///         msg.sender in the frontend, but any participant can log an
    ///         expense on behalf of another). The amount is split equally
    ///         among `splitAmong` — which does not have to be every participant.
    function addExpense(
        uint256 amount,
        string calldata desc,
        address payerAddr,
        address[] calldata splitAmong
    ) external onlyGroup onlyParticipant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(desc).length > 0, "Description required");
        require(isParticipant[payerAddr], "Payer must be a participant");
        require(splitAmong.length > 0, "Must split among at least one participant");

        _recordExpense(payerAddr, amount, desc, splitAmong);
    }

    function _recordExpense(
        address payerAddr,
        uint256 amount,
        string memory desc,
        address[] memory splitAmong
    ) internal {
        uint256 n = splitAmong.length;
        uint256 share = amount / n;

        for (uint256 i = 0; i < n; i++) {
            address p = splitAmong[i];
            require(isParticipant[p], "Split participant not in group");
            balances[p] -= int256(share);
        }
        balances[payerAddr] += int256(amount);

        expenses.push(Expense(payerAddr, amount, desc, splitAmong, block.timestamp));
        emit ExpenseAdded(expenses.length - 1, payerAddr, amount, desc, splitAmong, block.timestamp);
    }

    /// @notice Settle your outstanding debt in one transaction. Sends MON
    ///         that gets distributed across everyone you owe, proportional
    ///         to how much each of them is currently owed. Any leftover
    ///         (rounding dust, or overpayment) is refunded immediately.
    function settleAll() external payable onlyGroup onlyParticipant {
        require(msg.value > 0, "Must send value");
        require(balances[msg.sender] < 0, "You don't owe anything");

        uint256 totalDebt = uint256(-balances[msg.sender]);
        uint256 toDistribute = msg.value > totalDebt ? totalDebt : msg.value;

        uint256 n = participants.length;
        uint256 totalCredit = 0;
        for (uint256 i = 0; i < n; i++) {
            int256 b = balances[participants[i]];
            if (b > 0) totalCredit += uint256(b);
        }
        require(totalCredit > 0, "No creditors to pay");

        uint256 distributed = 0;
        for (uint256 i = 0; i < n; i++) {
            address p = participants[i];
            int256 b = balances[p];
            if (b > 0) {
                uint256 portion = (toDistribute * uint256(b)) / totalCredit;
                if (portion > 0) {
                    balances[p] -= int256(portion);
                    balances[msg.sender] += int256(portion);
                    distributed += portion;
                    (bool sent, ) = p.call{value: portion}("");
                    require(sent, "Transfer failed");
                }
            }
        }

        uint256 refund = msg.value - distributed;
        if (refund > 0) {
            (bool sent, ) = msg.sender.call{value: refund}("");
            require(sent, "Refund failed");
        }

        emit Settled(msg.sender, distributed, refund);
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

    /// @notice Payer deposits native token into the escrow. Can be called
    ///         more than once (e.g. topping up toward targetAmount).
    function lockFunds() external payable onlyEscrow {
        require(msg.sender == payer, "Only payer can deposit funds");
        require(msg.value > 0, "Must send value");
        require(!released, "Already released");

        lockedAmount += msg.value;
        emit FundsLocked(msg.sender, msg.value);
    }

    /// @notice Payer manually releases locked funds to the recipient at any
    ///         time (e.g. once satisfied with delivered work).
    function release() external onlyEscrow {
        require(msg.sender == payer, "Only payer can release manually");
        _release(false);
    }

    /// @notice Recipient claims locked funds once the deadline has passed,
    ///         protecting them if the payer goes silent.
    function claim() external onlyEscrow {
        require(msg.sender == recipient, "Only recipient can claim");
        require(block.timestamp >= deadline, "Deadline not reached yet");
        _release(true);
    }

    function _release(bool autoReleased) internal {
        require(!released, "Already released");
        require(lockedAmount > 0, "No funds locked");

        released = true;
        uint256 amount = lockedAmount;
        lockedAmount = 0;

        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsReleased(recipient, amount, autoReleased);
    }

    function isClaimable() external view returns (bool) {
        return agreementType == AgreementType.Escrow && !released && block.timestamp >= deadline && lockedAmount > 0;
    }

    function escrowStatus() external view returns (EscrowStatus) {
        require(agreementType == AgreementType.Escrow, "Not an escrow agreement");
        if (released) return EscrowStatus.Released;
        if (block.timestamp >= deadline) return EscrowStatus.Expired;
        if (lockedAmount > 0) return EscrowStatus.Locked;
        return EscrowStatus.AwaitingDeposit;
    }

    // ---------------------------------------------------------------------
    receive() external payable {
        revert("Use lockFunds()");
    }
}   