/* eslint-disable  global-require */

module.exports = {
    middlewares: [
        "responseTimer",
        "requestIdentifier",
        "cors",
    ],
    routes: [
        require("./routes/grocery-lists"),
        require("./routes/categories"),
        require("./routes/quantity-types"),
        require("./routes/login"),
        require("./routes/signup"),
        require("./routes/households"),
        require("./routes/users"),
        require("./routes/items"),
    ],
};
