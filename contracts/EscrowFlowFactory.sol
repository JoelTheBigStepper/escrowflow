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
    /// @param _deadlineDays Days from now until the deadline (auto-release
    ///        for Escrow, informational for Group)
    /// @param _participants Initial participant list (Group mode only, can
    ///        be empty and grown by inviting later off-chain / re-sharing
    ///        the address)
    /// @param _provider Service provider address (Escrow mode only, ignored
    ///        for Group)
    function createAgreement(
        Agreement.AgreementType _type,
        string calldata _title,
        uint256 _deadlineDays,
        address[] calldata _participants,
        address _provider
    ) external returns (address agreementAddress) {
        require(bytes(_title).length > 0, "Title required");
        require(_deadlineDays > 0 && _deadlineDays <= 3650, "Invalid deadline");

        if (_type == Agreement.AgreementType.Escrow) {
            require(_provider != address(0) && _provider != msg.sender, "Invalid provider");
        }

        Agreement instance = new Agreement();
        address deployed = address(instance);
        uint256 deadline = block.timestamp + (_deadlineDays * 1 days);

        instance.initialize(_type, _title, msg.sender, deadline, _participants, _provider);

        allAgreements.push(deployed);
        _userAgreements[msg.sender].push(deployed);

        if (_type == Agreement.AgreementType.Escrow) {
            _userAgreements[_provider].push(deployed);
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
