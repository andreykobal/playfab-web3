using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using System.Text;

public class AuthenticateSessionTicket : MonoBehaviour
{
    // URL of the authentication endpoint
    private const string AuthUrl = "http://wallet-manager-service.azurewebsites.net/authenticate";

    // Modified Authenticate method to accept a callback action
    public void Authenticate(string sessionTicket, Action callback)
    {
        StartCoroutine(SendSessionTicket(sessionTicket, callback));
    }

    // Modified Coroutine to accept and invoke the callback action
    IEnumerator SendSessionTicket(string sessionTicket, Action callback)
    {
        byte[] jsonToSend = new UTF8Encoding().GetBytes("{\"sessionTicket\":\"" + sessionTicket + "\"}");

        UnityWebRequest request = new UnityWebRequest(AuthUrl, "POST");
        request.uploadHandler = (UploadHandler)new UploadHandlerRaw(jsonToSend);
        request.downloadHandler = (DownloadHandler)new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.ConnectionError || request.result == UnityWebRequest.Result.ProtocolError)
        {
            Debug.LogError("Error: " + request.error);
        }
        else
        {
            Debug.Log("Response: " + request.downloadHandler.text);
            callback?.Invoke(); // Invoke the callback function
        }
    }
}
