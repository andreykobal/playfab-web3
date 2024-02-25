using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;
using Newtonsoft.Json; // Ensure Newtonsoft.Json is available in your project
using System.Text;

public class DailyRewardsService : MonoBehaviour
{
    // Assuming PlayFabAuthService is a component that manages PlayFab authentication
    public Button distributeRewardsButton;

    // Define a delegate that represents the signature of the callback method
    public delegate void DailyRewardsDistributionComplete(string response);

    // Define an event based on the delegate
    public event DailyRewardsDistributionComplete OnDailyRewardsDistributionComplete;

    private void Start()
    {
        distributeRewardsButton.onClick.AddListener(OnDistributeRewardsButtonClicked);
    }

    private void OnDistributeRewardsButtonClicked()
    {
        string sessionTicket = PlayFabAuthService.SessionTicket; // Assuming authService has a public string SessionTicket
        StartCoroutine(SendDailyRewardsRequest(sessionTicket));
    }

    IEnumerator SendDailyRewardsRequest(string sessionTicket)
    {
        // Create an anonymous object to represent your data
        var data = new
        {
            sessionTicket = sessionTicket
        };

        // Serialize the object to a JSON string
        string json = JsonConvert.SerializeObject(data);

        // Log the JSON string for debugging purposes
        Debug.Log(json);

        byte[] jsonToSend = Encoding.UTF8.GetBytes(json);
        var url = "http://localhost:3000/distributedailyrewards";
        using (var request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = (UploadHandler)new UploadHandlerRaw(jsonToSend);
            request.downloadHandler = (DownloadHandler)new DownloadHandlerBuffer();
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
                // Trigger the callback event with the response
                OnDailyRewardsDistributionComplete?.Invoke(request.downloadHandler.text);
            }
        }
    }
}
