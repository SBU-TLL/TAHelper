<?php
$request = $_GET["request"];
$type = $_GET["type"];
// var_dump($request, $type);

switch ($type) {
  case "all":
    $fn_pattern = "studentResponses/*";
    break;
  case "mix":
    $data = $_POST["data"];
    $evaluators = $data["Evaluators"];
    $groups = $data["Groups"];
    // guaranteed to have at least one element in $evaluators or $groups at this point
    if (empty($evaluators)) {
      $fn_pattern = "studentResponses/*_{" . implode(',', $groups) . "}_*";
    } else if (empty($groups)) {
      $fn_pattern = "studentResponses/{" . implode(',', $evaluators). "}_*";
    } else {
      $fn_pattern = "studentResponses/{" . implode(',', $evaluators). "}_{" . implode(',', $groups) . "}_*";
    }
    break;
  default:
    print("Something went wrong in responseInfo.php");
    exit;
}
// print($fn_pattern . "\n");

if ($request == "clear") { /* Clear Responses */
  array_map('unlink', glob($fn_pattern, GLOB_BRACE));
} else { /* Download Responses */
  header('Content-type: text/csv');
  header('Content-disposition: attachment; filename=responses.csv');
  $outfile = fopen('php://output', 'w');

  $fn_template = "json/templates.json";
  $template = file_get_contents($fn_template);
  $decoded_template = json_decode($template, true);
  // print_r($decoded_template);

  $header = array("Evaluator", "Date Evaluated", "Group", "Student NetID", "Student Last Name", "Student First Name");
  $student_form = $decoded_template["Student Evaluation"];
  foreach ($student_form as $form_elem) {
    // print_r($form_elem);
    $question = $form_elem["Question"];
    array_push($header, $question);
  }
  
  // print_r(implode(',', $header));
  fputcsv($outfile, $header);

  foreach(glob($fn_pattern, GLOB_BRACE) as $file) {
    // print($file . "\n");
    // continue;
  
    $raw_data = file_get_contents($file);
    $json_data = json_decode($raw_data, true);
    // print_r($json_data);
  
    $details = $json_data["Details"];
    $form_data = $json_data["Student Evaluation"];
  
    $date_evaluated = $details["Date"];
    $evaluator = $details["Evaluated By"];
    $group = $details["Group"];
    $stud_id = $details["Student NetID"];
    
    // for students with two first names
    $stud_name = explode(' ', $details["Student Name"]);
    if (count($stud_name) > 2) {
      list($fn1, $fn2, $last_name) = $stud_name;
      $first_name = $fn1 . " " . $fn2;
    } else {
      list($first_name, $last_name) = $stud_name;
    }
    
    $entry = array($evaluator, $date_evaluated, $group, $stud_id, $last_name, $first_name);
    foreach ($form_data as $form_elem) {
      array_push($entry, $form_elem["Value"]);
    }
  
    // write entry to output in csv format
    fputcsv($outfile, $entry);
  }
}

// if ($request == "clear") {  /* Clear request */
//   array_map('unlink', glob($type . "Responses/Group{" . $group_filter . "}*", GLOB_BRACE));
//   // foreach (glob($type . "Responses/Group{" . $group_filter . "}*", GLOB_BRACE) as $pathname) {
//   //   unlink($pathname);
//   // }

// } else {  /* Download request */

//   header('Content-type: text/csv');
//   header('Content-disposition: attachment; filename=responses.csv');
//   $outfile = fopen('php://output', 'w');

//   if ($type == "student") { // student responses
//     $header = array("Last Name", "First Name", "Group ID");
//     $filename = "json/questionnaire.json";
//   } else {  // group responses
//     $header = array("Group ID");
//     $filename = "json/evaluation.json";
//   }
//   // print_r(implode(',', $header));
//   // $typeMap=array("Student"=>"studt")

//   $form_data = file_get_contents($filename);
//   $decoded_formdata = json_decode($form_data);
//   // print_r($decoded_formdata);

//   foreach ($decoded_formdata as $form_elem) {
//     // print_r($form_elem);
//     $question = $form_elem->class;
//     if (!in_array($question, $header)) {
//       array_push($header, $question);
//     }
//   }
//   // print_r(implode(',', $header));
//   // echo '<br/>';
//   fputcsv($outfile, $header);

//   foreach (glob($type . "Responses/Group{" . $group_filter . "}*", GLOB_BRACE) as $pathname) {
//       $replace = array(".json", "Group");
//       list($dir, $filename) = explode("/", $pathname);
//       $info = str_replace($replace, "", explode("_", $filename));

//       if ($type == "group") { // group responses
//         $group_id = $info[0];
//         $entry = array($group_id);

//       } else {  // student responses

//         // for students with two first names
//         if (count($info) == 4) {
//           list($group_id, $fn1, $fn2, $last_name) = $info;
//           $first_name = $fn1 . " " . $fn2;
//         } else {
//           list($group_id, $first_name, $last_name) = $info;
//         }

//         $entry = array($last_name, $first_name, $group_id);
//       }
//       // print_r(implode(',', $entry));

//       $raw_data = file_get_contents($pathname);
//       $json_data = json_decode($raw_data);
//       // print_r($json_data);

//       foreach ($json_data->formData as $form_elem) {
//         // print_r($form_elem);
//         $input_type = $form_elem->type;
//         switch ($input_type) {
//           case 'textarea':
//             $response = $form_elem->html;
//             break;
//           default:
//             $response = $form_elem->value;
//         }
//         array_push($entry, $response);
//       }

//       // print_r(implode(',', $stud_array));
//       // echo '<br/>';
//       fputcsv($outfile, $entry);
//   }
// }
?>
