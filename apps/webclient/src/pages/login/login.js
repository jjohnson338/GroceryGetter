import { changePage } from '../../components/navigation-actions';
import { clearLoginErrorIfExists } from './login-actions';
import { connect } from 'react-redux';
import { greenA200 } from 'material-ui/styles/colors';
import { INVALID_EMAIL_ERROR } from '../../components/generic-errors';
import { lightBlue700 } from 'material-ui/styles/colors';
import { loginByEmail } from './login-actions';
import { loginCredentialChange } from './login-actions';
import { LOGIN_CREDENTIAL_TYPE_EMAIL } from './login-actions';
import { LOGIN_CREDENTIAL_TYPE_PASSWORD } from './login-actions';
import { loginValidationError } from './login-actions';
import PageComponent from '../../components/page-component';
import { PropTypes } from 'react';
import RaisedButton from 'material-ui/RaisedButton';
import React from 'react';
import SignupDialog from './login-components/signup-dialog';
import Snackbar from 'material-ui/Snackbar';
import TextField from 'material-ui/TextField';
import { toggleSnackbar } from './login-actions';
import validateEmail from '../../utils/validate-email';
import { white } from 'material-ui/styles/colors';


const style = {
  button: {
    margin: 12,
  },
  textField: {
    color: white,
  },
  h1: {
    color: '#FAFAFA',
  },
  paper: {
      height: '100%',
      backgroundColor: 'transparent',
  },
};


const LoginComponent = ({
            snackbarOpen,
            snackbarMessage,
            loginEmail,
            loginPassword,
            emailErrorText,
            toggleSnackbar,
            onLoginClick,
            onLoginCredentialChange,
            }) => {
    return (
<PageComponent styleOverride={style}>
    <div className="login-page">
        <div className="login">
            <h1 style={style.h1}>Grocery Groove</h1>
            <div>
                <TextField
                    hintText="Email Address"
                    floatingLabelText="Email Address"
                    inputStyle={style.textField}
                    value={loginEmail}
                    errorText={emailErrorText || ""}
                    onChange={onLoginCredentialChange.bind(null, LOGIN_CREDENTIAL_TYPE_EMAIL)}/>
                <br />
                <TextField
                    hintText="Password"
                    floatingLabelText="Password"
                    type="password"
                    inputStyle={style.textField}
                    value={loginPassword}
                    onChange={onLoginCredentialChange.bind(null, LOGIN_CREDENTIAL_TYPE_PASSWORD)}/>
                <br />
                <span>
                    <RaisedButton
                        label="Login"
                        primary={true}
                        style={style.button}
                        onTouchTap={onLoginClick.bind(null, loginEmail, loginPassword)}/>
                    <SignupDialog
                        style={style.button}/>
                </span>
            </div>
            <Snackbar
                open={snackbarOpen}
                message={snackbarMessage}
                autoHideDuration={4000}
                onRequestClose={toggleSnackbar}
                />
        </div>
    </div>
</PageComponent>
    );
};

LoginComponent.propTypes = {
    snackbarOpen: PropTypes.bool.isRequired,
    snackbarMessage: PropTypes.string,
    loginEmail: PropTypes.string.isRequired,
    loginPassword: PropTypes.string.isRequired,
    emailErrorText: PropTypes.string,
    toggleSnackbar: PropTypes.func.isRequired,
    onLoginClick: PropTypes.func.isRequired,
    onLoginCredentialChange: PropTypes.func.isRequired,
};

const mapStateToProps = (state, ownProps) => {
    return Object.assign({}, ownProps, {
        snackbarOpen: state.getIn([ 'login', 'snackbar', 'open' ]),
        snackbarMessage: state.getIn([ 'login', 'snackbar', 'message' ]),
        loginEmail: state.getIn([ 'login', 'loginCreds', 'email' ], ''),
        loginPassword: state.getIn([ 'login', 'loginCreds', 'password' ], ''),
        emailErrorText: state.getIn([ 'login', 'loginErrors', 'emailErrorText' ], ''),
    });
};

const mapDispatchToProps = (dispatch) => {
    return {
        toggleSnackbar: () => {
            dispatch(toggleSnackbar());
        },
        onLoginClick: (email, password) => {
            let errors = false;
            //Do some validation
            if (!validateEmail(email)) {
                dispatch(loginValidationError(INVALID_EMAIL_ERROR));
                errors = true;
            } else {
                dispatch(clearLoginErrorIfExists(INVALID_EMAIL_ERROR));
            }


            if (!errors) {
                //Do login
                dispatch(loginByEmail(email, password));
            }
        },
        onLoginCredentialChange: (credentialType, event) => {
            dispatch(loginCredentialChange(credentialType, event.target.value));
        },
    };
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LoginComponent);