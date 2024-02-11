using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using System.Text;

public class AuthenticateSessionTicket : MonoBehaviour
{
    // URL of the authentication endpoint
    private const string AuthUrl = "http://localhost:3000/authenticate";

    // Public method to start authentication process
    public void Authenticate(string sessionTicket)
    {
        StartCoroutine(SendSessionTicket(sessionTicket));
    }

    // Coroutine to send the session ticket to the server
    IEnumerator SendSessionTicket(string sessionTicket)
    {
        // Prepare the JSON payload
        byte[] jsonToSend = new UTF8Encoding().GetBytes("{\"sessionTicket\":\"" + sessionTicket + "\"}");

        // Create a UnityWebRequest to post the session ticket
        UnityWebRequest request = new UnityWebRequest(AuthUrl, "POST");
        request.uploadHandler = (UploadHandler)new UploadHandlerRaw(jsonToSend);
        request.downloadHandler = (DownloadHandler)new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");

        // Send the request and wait for a response
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.ConnectionError || request.result == UnityWebRequest.Result.ProtocolError)
        {
            // Handle errors
            Debug.LogError("Error: " + request.error);
        }
        else
        {
            // Handle the response
            Debug.Log("Response: " + request.downloadHandler.text);
        }
    }
}
