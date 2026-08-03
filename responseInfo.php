<?php
$request = $_GET["request"];
$type = $_GET["type"];
// var_dump($request, $type);
function makeRow($json_data){
	global $outfile;
	$details = $json_data["Details"];
	$form_data = $json_data["Student Evaluation"];

	$date_evaluated = $details["Date"];
	$evaluator = $details["Evaluated By"];
	$group = $details["Group"];
	$group=str_replace("-","_",$group);
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
		//print_r($form_elem);
		if (array_key_exists("Value", $form_elem)){
			array_push($entry, $form_elem["Value"]);
		}
	}


	// write entry to output in csv format
	fputcsv($outfile, $entry);
}
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
		makeRow($json_data);
	}
}

?>
