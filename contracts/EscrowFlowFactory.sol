// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Agreement.sol";

/// @title EscrowFlowFactory
/// @notice Deploys a fresh, independent Agreement contract per agreement,
///         and keeps a registry so the frontend can list a user's agreements.
contract EscrowFlowFactory {
    address[] public allAgreements;
    mapping(address => address[]) private _userAgreements;

    event AgreementCreated(
        address indexed agreementAddress,
        address indexed creator,
        Agreement.AgreementType agreementType,
        string title,
        uint256 deadline
    );

    /// @param _type 0 = Group, 1 = Escrow
    /// @param _title Human readable name for the agreement
    /// @param _description Group pot description, or escrow service description
    /// @param _deadlineDays Days from now until the deadline
    /// @param _participants Initial participant list (Group mode only — the
    ///        creator is always added automatically, more can be invited later)
    /// @param _recipient Who gets paid (Escrow mode only, ignored for Group)
    /// @param _targetAmount Amount the payer intends to lock (Escrow mode
    ///        only, informational — deposits are still flexible)
    ///
    /// For Group mode, send MON with this call to record an "Initial deposit"
    /// expense immediately, split across the starting participants.
    function createAgreement(
        Agreement.AgreementType _type,
        string calldata _title,
        string calldata _description,
        uint256 _deadlineDays,
        address[] calldata _participants,
        address _recipient,
        uint256 _targetAmount
    ) external payable returns (address agreementAddress) {
        require(bytes(_title).length > 0, "Title required");
        require(_deadlineDays > 0 && _deadlineDays <= 3650, "Invalid deadline");

        if (_type == Agreement.AgreementType.Escrow) {
            require(_recipient != address(0) && _recipient != msg.sender, "Invalid recipient");
        }

        Agreement instance = new Agreement();
        address deployed = address(instance);
        uint256 deadline = block.timestamp + (_deadlineDays * 1 days);

        instance.initialize{value: msg.value}(
            _type,
            _title,
            _description,
            msg.sender,
            deadline,
            _participants,
            _recipient,
            _targetAmount
        );

        allAgreements.push(deployed);
        _userAgreements[msg.sender].push(deployed);

        if (_type == Agreement.AgreementType.Escrow) {
            _userAgreements[_recipient].push(deployed);
        } else {
            for (uint256 i = 0; i < _participants.length; i++) {
                if (_participants[i] != msg.sender) {
                    _userAgreements[_participants[i]].push(deployed);
                }
            }
        }

        emit AgreementCreated(deployed, msg.sender, _type, _title, deadline);
        return deployed;
    }

    function getAllAgreements() external view returns (address[] memory) {
        return allAgreements;
    }

    function getUserAgreements(address user) external view returns (address[] memory) {
        return _userAgreements[user];
    }

    function agreementsCount() external view returns (uint256) {
        return allAgreements.length;
    }
}