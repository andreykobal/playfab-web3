﻿//--------------------------------------------------------------------------------------
// LoginWindowView.cs
//
// Advanced Technology Group (ATG)
// Copyright (C) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//--------------------------------------------------------------------------------------

using UnityEngine;
using UnityEngine.UI;
using PlayFab;
using PlayFab.ClientModels;
using System.Collections.Generic;
using System;

public class LoginWindowView : MonoBehaviour
{
    // Debug Flag to simulate a reset
    public bool ClearPlayerPrefs;

    // Meta fields for objects in the UI
    public InputField Username;
    public InputField Password;
    public InputField ConfirmPassword;
    public Toggle RememberMe;

    public Button LoginButton;
    public Button PlayAsGuestButton;
    public Button RegisterButton;
    public Button CancelRegisterButton;
    public Button ClearSigninButton;
    public Button ResetSampleButton;

    // Meta references to panels we need to show / hide
    public GameObject RegisterPanel;
    public GameObject SigninPanel;
    public GameObject LoginPanel;
    public GameObject LoggedinPanel;
    public Text StatusText;
    public Text UserName;

    // Settings for what data to get from playfab on login.
    public GetPlayerCombinedInfoRequestParams InfoRequestParams;

    // Reference to our Authentication service
    private PlayFabAuthService _AuthService = PlayFabAuthService.Instance;

    public AuthenticateSessionTicket authenticateSessionTicket;
    public Text WalletAddressText;
    public Text TokenBalanceText;

    public Button AddPerformancePointsButton;
    public Button GetPerformancePointsButton;

    public TokenTransferService tokenTransferService;
    public DailyRewardsService dailyRewardsService;

    public GameObject gameObjectToActivate; // Reference to the game object to activate/deactivate





    public void Awake()
    {
        if (ClearPlayerPrefs)
        {
            _AuthService.UnlinkSilentAuth();
            _AuthService.ClearRememberMe();
            _AuthService.AuthType = Authtypes.None;
        }

        //Set our remember me button to our remembered state.
        RememberMe.isOn = _AuthService.RememberMe;

        //Subscribe to our Remember Me toggle
        RememberMe.onValueChanged.AddListener(
            (toggle) =>
            {
                _AuthService.RememberMe = toggle;
            });
    }

    public void Start()
    {
        // Hide all our panels until we know what UI to display
        LoginPanel.SetActive(false);
        LoggedinPanel.SetActive(false);
        RegisterPanel.SetActive(false);
        SigninPanel.SetActive(true);

        // Subscribe to events that happen after we authenticate
        PlayFabAuthService.OnDisplayAuthentication += OnDisplayAuthentication;
        PlayFabAuthService.OnLoginSuccess += OnLoginSuccess;
        PlayFabAuthService.OnPlayFabError += OnPlayFaberror;

        // Bind to UI buttons to perform actions when user interacts with the UI.
        LoginButton.onClick.AddListener(OnLoginClicked);
        PlayAsGuestButton.onClick.AddListener(OnPlayAsGuestClicked);
        RegisterButton.onClick.AddListener(OnRegisterButtonClicked);
        CancelRegisterButton.onClick.AddListener(OnCancelRegisterButtonClicked);
        ResetSampleButton.onClick.AddListener(OnResetSampleButtonClicked);
        ClearSigninButton.onClick.AddListener(OnClearSigninButtonClicked);
        AddPerformancePointsButton.onClick.AddListener(AddPerformancePoints);
        GetPerformancePointsButton.onClick.AddListener(GetPerformancePoints);

        // Set the data we want at login from what we chose in our meta data.
        _AuthService.InfoRequestParams = InfoRequestParams;

        // Start the authentication process.
        _AuthService.Authenticate();

        Debug.Log("Subscribing to TokenTransferComplete event.");
        tokenTransferService.OnTokenTransferComplete += TokenTransferCompleted;

        Debug.Log("Subscribing to DailyRewardsDistributionComplete event.");
        dailyRewardsService.OnDailyRewardsDistributionComplete += DailyRewardsDistributionCompleted;

    }

    private void OnDestroy()
    {
        // Unsubscribe to prevent memory leaks
        tokenTransferService.OnTokenTransferComplete -= TokenTransferCompleted;

        dailyRewardsService.OnDailyRewardsDistributionComplete -= DailyRewardsDistributionCompleted;
    }

    // This method will be called when the token transfer is complete
    private void TokenTransferCompleted(string response)
    {
        Debug.Log("Token transfer completed. Response: " + response);
        //update token balance
        RetrieveUserTokenBalance(PlayFabAuthService.PlayFabId);
    }

    // This method will be called when the daily rewards distribution is complete
    private void DailyRewardsDistributionCompleted(string response)
    {
        Debug.Log("Daily rewards distribution completed. Response: " + response);
        RetrieveUserTokenBalance(PlayFabAuthService.PlayFabId);

    }


    public void AddPerformancePoints()
    {
        // First, get the current performance points
        PlayFabClientAPI.GetUserData(new GetUserDataRequest
        {
            PlayFabId = PlayFabAuthService.PlayFabId,
            Keys = new List<string> { "PerformancePoints" }
        }, result =>
        {
            int currentPoints = 0;
            if (result.Data != null && result.Data.ContainsKey("PerformancePoints"))
            {
                // Parse the existing points and add 100
                int.TryParse(result.Data["PerformancePoints"].Value, out currentPoints);
                currentPoints += 100;
            }
            else
            {
                // If there are no existing points, start with 100
                currentPoints = 100;
            }

            // Update the performance points with the new value
            PlayFabClientAPI.UpdateUserData(new UpdateUserDataRequest
            {
                Data = new Dictionary<string, string>
                {
                { "PerformancePoints", currentPoints.ToString() }
                }
            }, updateResult =>
            {
                Debug.Log("Performance Points added successfully");
            }, error =>
            {
                Debug.Log("Got error setting Performance Points:");
                Debug.Log(error.GenerateErrorReport());
            });

        }, error =>
        {
            Debug.Log("Got error retrieving Performance Points:");
            Debug.Log(error.GenerateErrorReport());
        });
    }

    // This function remains unchanged but is necessary for the complete workflow
    public void GetPerformancePoints()
    {
        PlayFabClientAPI.GetUserData(new GetUserDataRequest
        {
            PlayFabId = PlayFabAuthService.PlayFabId,
            Keys = null
        }, result =>
        {
            if (result.Data != null && result.Data.ContainsKey("PerformancePoints"))
            {
                Debug.Log("Performance Points: " + result.Data["PerformancePoints"].Value);
            }
            else
            {
                Debug.Log("Performance Points not found");
            }
        }, error =>
        {
            Debug.Log("Got error retrieving Performance Points:");
            Debug.Log(error.GenerateErrorReport());
        });
    }




    /// <summary>
    /// WEB3 Playfab
    /// </summary>
    private void GetUserReadOnlyData(string playFabId, string key, Action<string> onSuccess, Action<string> onError)
    {
        PlayFabClientAPI.GetUserReadOnlyData(new GetUserDataRequest
        {
            PlayFabId = playFabId,
            Keys = new List<string> { key } // Use the specified key
        }, result =>
        {
            if (result.Data.ContainsKey(key))
            {
                Debug.Log($"{key}: " + result.Data[key].Value);
                onSuccess?.Invoke(result.Data[key].Value);
            }
            else
            {
                Debug.Log($"{key} not found");
                onSuccess?.Invoke("");
            }
        }, error =>
        {
            Debug.Log($"Got error retrieving {key}:");
            Debug.Log(error.GenerateErrorReport());
            onError?.Invoke(error.GenerateErrorReport());
        });
    }

    private void RetrieveUserWalletAddress(string playFabId)
    {
        GetUserReadOnlyData(playFabId, "WalletAddress", value =>
        {
            // onSuccess
            WalletAddressText.text = "Wallet Address: " + value;
        }, error =>
        {
            // onError
            Debug.Log(error);
        });
    }

    private void RetrieveUserTokenBalance(string playFabId)
    {
        GetUserReadOnlyData(playFabId, "TokenBalance", value =>
        {
            // onSuccess
            TokenBalanceText.text = "Token Balance: " + value;
        }, error =>
        {
            // onError
            Debug.Log(error);
        });
    }





    /// <summary>
    /// Login Successfully - Goes to next screen.
    /// </summary>
    /// <param name="result"></param>
    private void OnLoginSuccess(PlayFab.ClientModels.LoginResult result)
    {
        Debug.LogFormat("Logged In as: {0}", result.PlayFabId);
        Debug.LogFormat("Session Ticket: {0}", result.SessionTicket);

        // Activate the game object when logged in
        if (gameObjectToActivate != null)
            gameObjectToActivate.SetActive(true);

        // Pass a lambda as a callback to Authenticate method
        authenticateSessionTicket.Authenticate(result.SessionTicket, () =>
        {
            Debug.Log("Authenticated with custom server");
            RetrieveUserWalletAddress(result.PlayFabId);
            RetrieveUserTokenBalance(result.PlayFabId);
        });

        StatusText.text = "";
        LoginPanel.SetActive(false);
        LoggedinPanel.SetActive(true);
        UserName.text = result.InfoResultPayload.AccountInfo.Username ?? result.PlayFabId;
    }

    /// <summary>
    /// Error handling for when Login returns errors.
    /// </summary>
    /// <param name="error"></param>
    private void OnPlayFaberror(PlayFabError error)
    {
        //There are more cases which can be caught, below are some
        //of the basic ones.
        switch (error.Error)
        {
            case PlayFabErrorCode.InvalidEmailAddress:
            case PlayFabErrorCode.InvalidPassword:
            case PlayFabErrorCode.InvalidEmailOrPassword:
                StatusText.text = "Invalid Email or Password";
                break;

            case PlayFabErrorCode.AccountNotFound:
                RegisterPanel.SetActive(true);
                SigninPanel.SetActive(false);
                return;
            default:
                StatusText.text = error.GenerateErrorReport();
                break;
        }

        //Also report to debug console, this is optional.
        Debug.Log(error.Error);
        Debug.LogError(error.GenerateErrorReport());
    }

    /// <summary>
    /// Choose to display the Auth UI or any other action.
    /// </summary>
    private void OnDisplayAuthentication()
    {
        // Deactivate the game object when not logged in
        if (gameObjectToActivate != null)
            gameObjectToActivate.SetActive(false);

        //Here we have choses what to do when AuthType is None.
        LoginPanel.SetActive(true);
        LoggedinPanel.SetActive(false);
        StatusText.text = "";

        /*
         * Optionally we could Not do the above and force login silently
         * 
         * _AuthService.Authenticate(Authtypes.Silent);
         * 
         * This example, would auto log them in by device ID and they would
         * never see any UI for Authentication.
         * 
         */
    }

    /// <summary>
    /// Play As a guest, which means they are going to silently authenticate
    /// by device ID or Custom ID
    /// </summary>
    private void OnPlayAsGuestClicked()
    {

        StatusText.text = "Logging In As Guest ...";

        _AuthService.Authenticate(Authtypes.Silent);
    }

    /// <summary>
    /// Login Button means they've selected to submit a username (email) / password combo
    /// Note: in this flow if no account is found, it will ask them to register.
    /// </summary>
    private void OnLoginClicked()
    {
        StatusText.text = string.Format("Logging In As {0} ...", Username.text);

        _AuthService.Email = Username.text;
        _AuthService.Password = Password.text;
        _AuthService.Authenticate(Authtypes.EmailAndPassword);
    }

    /// <summary>
    /// No account was found, and they have selected to register a username (email) / password combo.
    /// </summary>
    private void OnRegisterButtonClicked()
    {
        if (Password.text != ConfirmPassword.text)
        {
            StatusText.text = "Passwords do not Match.";
            return;
        }

        StatusText.text = string.Format("Registering User {0} ...", Username.text);

        _AuthService.Email = Username.text;
        _AuthService.Password = Password.text;
        _AuthService.Authenticate(Authtypes.RegisterPlayFabAccount);
    }

    /// <summary>
    /// They have opted to cancel the Registration process.
    /// Possibly they typed the email address incorrectly.
    /// </summary>
    private void OnCancelRegisterButtonClicked()
    {
        // Reset all forms
        Username.text = string.Empty;
        Password.text = string.Empty;
        ConfirmPassword.text = string.Empty;

        // Show panels
        RegisterPanel.SetActive(false);
        SigninPanel.SetActive(true);
    }

    private void OnClearSigninButtonClicked()
    {
        _AuthService.ClearRememberMe();
        StatusText.text = "Signin info cleared";
    }

    private void OnResetSampleButtonClicked()
    {
        PlayFabClientAPI.ForgetAllCredentials();
        _AuthService.Email = string.Empty;
        _AuthService.Password = string.Empty;
        _AuthService.AuthTicket = string.Empty;
        _AuthService.Authenticate();
    }
}