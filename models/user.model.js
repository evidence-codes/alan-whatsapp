const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database.config");
const Subscription = require("./subscription.model")

const User = sequelize.define(
    'user',
    {
        phoneNumber: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        email: {
            type: DataTypes.STRING,
            unique: true
        },
        hasUsedFreeTrial: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        hasExceededFreeTrialLimit: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
    }
)

// Define associations
User.hasOne(Subscription);
Subscription.belongsTo(User);

module.exports = User;



