const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database.config");

const Subscription = sequelize.define(
    'subscription',
    {
        expirationDate: {
            type: DataTypes.DATE,
            allowNull: false
        }
    }
)

module.exports = Subscription;