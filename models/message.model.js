const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database.config");
const User = require("./user.model")

const Message = sequelize.define(
    'message',
    {
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    });

User.hasMany(Message);
Message.belongsTo(User);

module.exports = Message;



