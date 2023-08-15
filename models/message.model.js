const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database.config");
const User = require("./user.model")

const Message = sequelize.define(
    'message',
    {
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: new Date()
        }
    });

User.hasMany(Message);
Message.belongsTo(User);

module.exports = Message;



