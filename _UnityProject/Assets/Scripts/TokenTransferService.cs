using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Networking;
using Newtonsoft.Json; // Make sure to add this using directive
using System.Text;

public class TokenTransferService : MonoBehaviour
{
    public PlayFabAuthService authService; // Drag your PlayFabAuthService object here in the inspector
    public InputField userIdInputField;
    public InputField amountInputField;
    public Button sendButton;

    // Define a delegate that represents the signature of the callback method
    public delegate void TokenTransferComplete(string response);

    // Define an event based on the delegate
    public event TokenTransferComplete OnTokenTransferComplete;


    private void Start()
    {
        sendButton.onClick.AddListener(OnSendButtonClicked);
    }

    private void OnSendButtonClicked()
    {
        string sessionTicket = PlayFabAuthService.SessionTicket; // Assuming PlayFabAuthService has a public static string SessionTicket
        string recipientUserId = userIdInputField.text;
        int amount = int.Parse(amountInputField.text);

        StartCoroutine(SendTransferTokenRequest(sessionTicket, recipientUserId, amount));
    }

    IEnumerator SendTransferTokenRequest(string sessionTicket, string recipientUserId, int amount)
    {
        // Create an anonymous object to represent your data
        var data = new
        {
            sessionTicket = sessionTicket,
            recipientUserId = recipientUserId,
            amount = amount
        };

        // Use JsonConvert to serialize the object to a JSON string
        string json = JsonConvert.SerializeObject(data);

        // Log the JSON string for debugging
        Debug.Log(json);

        byte[] jsonToSend = Encoding.UTF8.GetBytes(json);
        var url = "https://wallet-manager-service.azurewebsites.net/transferToken";
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(jsonToSend);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.ConnectionError ||
                request.result == UnityWebRequest.Result.ProtocolError)
            {
                Debug.LogError(request.error);
            }
            else
            {
                Debug.Log("Response: " + request.downloadHandler.text);
                // Here you can handle the callback response
                Debug.Log("About to invoke OnTokenTransferComplete event.");
                OnTokenTransferComplete?.Invoke(request.downloadHandler.text);


            }
        }
    }
}
