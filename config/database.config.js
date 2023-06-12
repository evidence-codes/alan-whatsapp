const { Sequelize } = require("sequelize");
require("dotenv").config()

const { DB_URI } = process.env;

// const sequelize = new Sequelize(db, db_user, db_pass, {
//     host: db_host,
//     dialect: "postgres"
// });

const sequelize = new Sequelize(DB_URI)

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ force: true });
        console.log('Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

module.exports = { connectDB, sequelize }
